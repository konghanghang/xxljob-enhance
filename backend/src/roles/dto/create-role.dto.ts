import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

/**
 * Create Role DTO
 */
export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
