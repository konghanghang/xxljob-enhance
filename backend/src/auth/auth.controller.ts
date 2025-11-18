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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
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
@ApiTags('auth')
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
  @ApiOperation({ summary: 'User login', description: 'Authenticate user with username and password, returns JWT tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Refresh access token', description: 'Get new access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
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
  @ApiOperation({ summary: 'User logout', description: 'Logout user and create audit log entry' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns current authenticated user information from JWT token' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
