/**
 * User Response DTO
 * Excludes sensitive information like password
 */
export class UserResponseDto {
  id!: number;
  username!: string;
  email!: string | null;
  isAdmin!: boolean;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
