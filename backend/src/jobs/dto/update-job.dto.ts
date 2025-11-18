import { IsString, IsInt, IsOptional } from 'class-validator';

/**
 * Update Job DTO
 */
export class UpdateJobDto {
  @IsString()
  @IsOptional()
  jobDesc?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  alarmEmail?: string;

  @IsString()
  @IsOptional()
  scheduleType?: string;

  @IsString()
  @IsOptional()
  scheduleConf?: string;

  @IsString()
  @IsOptional()
  executorHandler?: string;

  @IsString()
  @IsOptional()
  executorParam?: string;

  @IsInt()
  @IsOptional()
  executorTimeout?: number;

  @IsInt()
  @IsOptional()
  executorFailRetryCount?: number;
}
