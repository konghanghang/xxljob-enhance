import { IsInt, IsString, IsNotEmpty, IsBoolean } from 'class-validator';

/**
 * Set Job Permission DTO
 */
export class SetJobPermissionDto {
  @IsInt()
  jobId!: number;

  @IsString()
  @IsNotEmpty()
  appName!: string;

  @IsBoolean()
  canView!: boolean;

  @IsBoolean()
  canExecute!: boolean;

  @IsBoolean()
  canEdit!: boolean;
}
