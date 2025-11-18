import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SetJobPermissionDto } from './set-job-permission.dto';

/**
 * Batch Set Permissions DTO
 */
export class BatchSetPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetJobPermissionDto)
  permissions!: SetJobPermissionDto[];
}
