import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Update Role DTO
 */
export class UpdateRoleDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
