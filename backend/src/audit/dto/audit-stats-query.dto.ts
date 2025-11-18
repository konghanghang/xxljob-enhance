import { IsDateString, IsOptional } from 'class-validator';

/**
 * Audit Stats Query DTO
 */
export class AuditStatsQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
