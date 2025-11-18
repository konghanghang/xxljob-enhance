import { IsInt, IsString, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Audit Query DTO
 */
export class AuditQueryDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  jobId?: number;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  skip?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  take?: number;
}
