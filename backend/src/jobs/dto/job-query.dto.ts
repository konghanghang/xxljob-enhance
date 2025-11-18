import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Job Query DTO
 */
export class JobQueryDto {
  @IsInt()
  @Type(() => Number)
  jobGroup!: number;

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
}
