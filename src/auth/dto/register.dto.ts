import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trimString = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
};

const normalizeEmail = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
};

export class RegisterDto {
  @ApiProperty({
    example: 'alice',
    minLength: 3,
    maxLength: 50,
    description: '用户名，支持字母、数字、_ . -',
  })
  @Transform(trimString)
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username can only contain letters, numbers, _, . and -',
  })
  username!: string;

  @ApiProperty({ example: 'alice@example.com', description: '邮箱地址' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional({
    example: 'Alice',
    maxLength: 100,
    description: '展示名称，可选',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
