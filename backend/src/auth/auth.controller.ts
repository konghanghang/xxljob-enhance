import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LoginResponseDto } from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authentication Controller
 * Handles user login, token refresh, and logout
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /auth/login
   * Authenticate user and return JWT tokens
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Log successful login
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        result: 'SUCCESS',
        message: 'User logged in successfully',
      },
    });

    return this.authService.login(user);
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Logout user (client should discard tokens)
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    // Log logout action
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGOUT',
        result: 'SUCCESS',
        message: 'User logged out successfully',
      },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * GET /auth/profile
   * Get current user profile (for testing JWT authentication)
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
