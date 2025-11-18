import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Refresh token request DTO
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
