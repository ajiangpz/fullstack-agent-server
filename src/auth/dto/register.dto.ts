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

const trimString = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
};

const normalizeEmail = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
};

export class RegisterDto {
  @Transform(trimString)
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username can only contain letters, numbers, _, . and -',
  })
  username!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
