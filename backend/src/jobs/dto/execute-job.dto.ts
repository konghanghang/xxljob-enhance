import { IsString, IsOptional } from 'class-validator';

/**
 * Execute Job DTO
 */
export class ExecuteJobDto {
  @IsString()
  @IsOptional()
  executorParam?: string;

  @IsString()
  @IsOptional()
  addressList?: string;
}
