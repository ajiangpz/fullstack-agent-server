[CmdletBinding()]
param(
    [ValidateSet('start', 'studio', 'migrate')]
    [string]$Mode = 'start'
)

$ErrorActionPreference = 'Stop'

function Import-EnvFile {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Environment file not found: $Path"
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmedLine = $line.Trim()

        if (-not $trimmedLine -or $trimmedLine.StartsWith('#')) {
            continue
        }

        $separatorIndex = $trimmedLine.IndexOf('=')
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $trimmedLine.Substring(0, $separatorIndex).Trim()
        $value = $trimmedLine.Substring($separatorIndex + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        Set-Item -LiteralPath "Env:$name" -Value $value
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Import-EnvFile -Path (Join-Path $projectRoot '.env')
Import-EnvFile -Path (Join-Path $projectRoot '.env.remote.local')

$requiredVariables = @(
    'DATABASE_URL',
    'REMOTE_SSH_HOST',
    'REMOTE_SSH_USER',
    'REMOTE_DB_HOST',
    'REMOTE_DB_PORT'
)

if ($Mode -eq 'start') {
    $requiredVariables += @(
        'REMOTE_REDIS_HOST',
        'REMOTE_REDIS_PORT',
        'LOCAL_REDIS_TUNNEL_PORT',
        'REDIS_PASSWORD'
    )
}

foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "$name is not configured."
    }
}

$localPortVariable = if ($Mode -eq 'studio') {
    'LOCAL_STUDIO_DB_TUNNEL_PORT'
}
else {
    'LOCAL_DB_TUNNEL_PORT'
}

$localPortValue = [Environment]::GetEnvironmentVariable($localPortVariable)
if ([string]::IsNullOrWhiteSpace($localPortValue)) {
    throw "$localPortVariable is not configured."
}

$localPort = [int]$localPortValue
$localRedisPort = if ($Mode -eq 'start') {
    [int]$env:LOCAL_REDIS_TUNNEL_PORT
}
else {
    $null
}
$tunnelPorts = if ($Mode -eq 'start') {
    @($localPort, $localRedisPort)
}
else {
    @($localPort)
}
$existingListener = Get-NetTCPConnection `
    -LocalPort $tunnelPorts `
    -State Listen `
    -ErrorAction SilentlyContinue

$reuseExistingTunnel = $false
if ($existingListener) {
    $listenerPorts = @($existingListener.LocalPort | Sort-Object -Unique)
    $listenerProcessIds = @(
        $existingListener.OwningProcess | Sort-Object -Unique
    )
    $expectedForward = (
        "-L ${localPort}:$($env:REMOTE_DB_HOST):$($env:REMOTE_DB_PORT)"
    )
    $expectedTarget = (
        "$($env:REMOTE_SSH_USER)@$($env:REMOTE_SSH_HOST)"
    )
    $existingProcesses = @(
        $listenerProcessIds | ForEach-Object {
            Get-CimInstance `
                -ClassName Win32_Process `
                -Filter "ProcessId = $_" `
                -ErrorAction SilentlyContinue
        }
    )
    $matchingDatabaseTunnel = (
        $Mode -ne 'start' -and
        $listenerPorts.Count -eq 1 -and
        $listenerPorts[0] -eq $localPort -and
        $existingProcesses.Count -eq 1 -and
        $existingProcesses[0].Name -eq 'ssh.exe' -and
        $existingProcesses[0].CommandLine.Contains($expectedForward) -and
        $existingProcesses[0].CommandLine.Contains($expectedTarget)
    )

    if ($matchingDatabaseTunnel) {
        $reuseExistingTunnel = $true
    }
    else {
        $usedPorts = $listenerPorts -join ', '
        throw "Local tunnel port is already in use: $usedPorts."
    }
}

if (
    [string]::IsNullOrWhiteSpace($env:REMOTE_SSH_PASSWORD) -and
    [string]::IsNullOrWhiteSpace($env:TLS_BUILD_SSH_PASSWORD)
) {
    $secretsLoader = Join-Path $HOME '.codex\load-secrets.ps1'
    if (Test-Path -LiteralPath $secretsLoader) {
        . $secretsLoader
    }
}

$sshPassword = if ($env:REMOTE_SSH_PASSWORD) {
    $env:REMOTE_SSH_PASSWORD
}
else {
    $env:TLS_BUILD_SSH_PASSWORD
}

$temporaryDirectory = $null
$tunnelProcess = $null
$originalDatabaseUrl = $env:DATABASE_URL
$originalRedisHost = $env:REDIS_HOST
$originalRedisPort = $env:REDIS_PORT

try {
    $sshArguments = @(
        '-T',
        '-N',
        '-L',
        "${localPort}:$($env:REMOTE_DB_HOST):$($env:REMOTE_DB_PORT)",
        '-o',
        'ConnectTimeout=10',
        '-o',
        'ExitOnForwardFailure=yes'
    )

    if ($Mode -eq 'start') {
        $sshArguments += @(
            '-L',
            "${localRedisPort}:$($env:REMOTE_REDIS_HOST):$($env:REMOTE_REDIS_PORT)"
        )
    }

    if ($sshPassword) {
        $temporaryDirectory = Join-Path (
            [IO.Path]::GetTempPath()
        ) ("fullstack-agent-ssh-" + [Guid]::NewGuid().ToString('N'))
        $askpassPath = Join-Path $temporaryDirectory 'askpass.cmd'
        $askpassContent = @'
@echo off
powershell.exe -NoProfile -NonInteractive -Command "[Console]::Out.Write($env:CODEX_REMOTE_SSH_PASSWORD)"
'@

        New-Item -ItemType Directory -Path $temporaryDirectory -Force |
            Out-Null
        Set-Content `
            -LiteralPath $askpassPath `
            -Value $askpassContent `
            -NoNewline `
            -Encoding Ascii

        $env:CODEX_REMOTE_SSH_PASSWORD = $sshPassword
        $env:SSH_ASKPASS = $askpassPath
        $env:SSH_ASKPASS_REQUIRE = 'force'
        $env:DISPLAY = 'codex:0'
        $sshArguments += @(
            '-o',
            'BatchMode=no',
            '-o',
            'NumberOfPasswordPrompts=1',
            '-o',
            'PreferredAuthentications=password',
            '-o',
            'PubkeyAuthentication=no'
        )
    }
    else {
        $sshArguments += @('-o', 'BatchMode=yes')
    }

    if (-not $reuseExistingTunnel) {
        $sshArguments += "$($env:REMOTE_SSH_USER)@$($env:REMOTE_SSH_HOST)"
        $tunnelProcess = Start-Process `
            -FilePath 'ssh.exe' `
            -ArgumentList $sshArguments `
            -WindowStyle Hidden `
            -PassThru

        $tunnelReady = $false
        foreach ($attempt in 1..20) {
            if ($tunnelProcess.HasExited) {
                throw 'SSH tunnel exited before becoming ready.'
            }

            $listeners = Get-NetTCPConnection `
                -LocalPort $tunnelPorts `
                -State Listen `
                -ErrorAction SilentlyContinue
            $listeningPorts = @($listeners.LocalPort | Sort-Object -Unique)
            if ($listeningPorts.Count -eq $tunnelPorts.Count) {
                $tunnelReady = $true
                break
            }

            Start-Sleep -Milliseconds 500
        }

        if (-not $tunnelReady) {
            throw 'SSH tunnel did not become ready.'
        }
    }

    $remoteDatabaseEndpoint = "@127.0.0.1:$localPort/"
    $env:DATABASE_URL = $originalDatabaseUrl -replace '@[^/]+/', $remoteDatabaseEndpoint
    if ($Mode -eq 'start') {
        $env:REDIS_HOST = '127.0.0.1'
        $env:REDIS_PORT = [string]$localRedisPort
    }

    if ($env:DATABASE_URL -eq $originalDatabaseUrl) {
        throw 'DATABASE_URL is not a supported PostgreSQL connection URL.'
    }

    Write-Host "Database tunnel ready on 127.0.0.1:$localPort."
    if ($Mode -eq 'start') {
        Write-Host "Redis tunnel ready on 127.0.0.1:$localRedisPort."
    }

    switch ($Mode) {
        'studio' {
            & npx prisma studio --port 5555
        }
        'migrate' {
            & npx prisma migrate deploy
        }
        default {
            & npm run start
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "$Mode command exited with code $LASTEXITCODE."
    }
}
finally {
    $env:DATABASE_URL = $originalDatabaseUrl
    $env:REDIS_HOST = $originalRedisHost
    $env:REDIS_PORT = $originalRedisPort

    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force
    }

    Remove-Item Env:CODEX_REMOTE_SSH_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SSH_ASKPASS -ErrorAction SilentlyContinue
    Remove-Item Env:SSH_ASKPASS_REQUIRE -ErrorAction SilentlyContinue
    Remove-Item Env:DISPLAY -ErrorAction SilentlyContinue

    if ($temporaryDirectory) {
        Remove-Item `
            -LiteralPath $temporaryDirectory `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }
}
