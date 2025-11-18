/**
 * Login response DTO
 */
export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: number;
    username: string;
    email: string | null;
    isAdmin: boolean;
  };
}
