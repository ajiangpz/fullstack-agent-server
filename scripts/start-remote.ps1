[CmdletBinding()]
param()

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
    'REMOTE_DB_PORT',
    'LOCAL_DB_TUNNEL_PORT'
)

foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "$name is not configured."
    }
}

$localPort = [int]$env:LOCAL_DB_TUNNEL_PORT
$existingListener = Get-NetTCPConnection `
    -LocalPort $localPort `
    -State Listen `
    -ErrorAction SilentlyContinue

if ($existingListener) {
    throw "Local port $localPort is already in use."
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

        $listener = Get-NetTCPConnection `
            -LocalPort $localPort `
            -State Listen `
            -ErrorAction SilentlyContinue
        if ($listener) {
            $tunnelReady = $true
            break
        }

        Start-Sleep -Milliseconds 500
    }

    if (-not $tunnelReady) {
        throw 'SSH tunnel did not become ready.'
    }

    $remoteDatabaseEndpoint = "@127.0.0.1:$localPort/"
    $env:DATABASE_URL = $originalDatabaseUrl -replace '@[^/]+/', $remoteDatabaseEndpoint

    if ($env:DATABASE_URL -eq $originalDatabaseUrl) {
        throw 'DATABASE_URL is not a supported PostgreSQL connection URL.'
    }

    Write-Host "SSH tunnel ready on 127.0.0.1:$localPort."
    & npm run start

    if ($LASTEXITCODE -ne 0) {
        throw "Application exited with code $LASTEXITCODE."
    }
}
finally {
    $env:DATABASE_URL = $originalDatabaseUrl

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
