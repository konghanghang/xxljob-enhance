import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * Login request DTO
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
