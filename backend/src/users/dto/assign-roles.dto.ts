import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

/**
 * Assign Roles DTO
 */
export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  roleIds!: number[];
}
