import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  username: string;
  isAdmin: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    isAdmin: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   * @param username - User's username
   * @param password - Plain text password
   * @returns User object without password if valid, null otherwise
   */
  async validateUser(
    username: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Remove password from returned object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Generate JWT access and refresh tokens
   * @param user - User object
   * @returns Login response with tokens and user info
   */
  async login(user: Omit<User, 'password'>): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    };

    const accessTokenExpiration = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '1h';
    const refreshTokenExpiration = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiration as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshTokenExpiration as any,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    };
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token string
   * @returns Decoded JWT payload
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Valid refresh token
   * @returns New access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = await this.verifyToken(refreshToken);

    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    };

    const accessTokenExpiration = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '1h';

    const accessToken = this.jwtService.sign(newPayload, {
      expiresIn: accessTokenExpiration as any,
    });

    return { accessToken };
  }

  /**
   * Hash password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
