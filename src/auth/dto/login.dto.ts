import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const normalizeEmail = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
};

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com', description: '邮箱地址' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: 1, description: '密码' })
  @IsString()
  @MinLength(1)
  password!: string;
}
