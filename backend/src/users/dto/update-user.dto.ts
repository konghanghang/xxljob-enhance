import { IsString, MinLength, IsEmail, IsOptional, IsBoolean } from 'class-validator';

/**
 * Update User DTO
 */
export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}
