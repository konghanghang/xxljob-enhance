import { IsString, IsNotEmpty, MinLength, IsEmail, IsOptional, IsBoolean } from 'class-validator';

/**
 * Create User DTO
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}
