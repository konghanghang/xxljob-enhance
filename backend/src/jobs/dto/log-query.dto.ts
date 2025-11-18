import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Log Query DTO
 */
export class LogQueryDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  start?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  length?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  logStatus?: number;
}
