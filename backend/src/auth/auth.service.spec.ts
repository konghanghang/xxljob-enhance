import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      password: 'hashedPassword123',
      email: 'test@example.com',
      isAdmin: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return null for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'nonexistent' },
      });
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.validateUser('testuser', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('testuser', 'password')).rejects.toThrow(
        'User account is disabled',
      );
    });

    it('should return null for invalid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword123');
    });

    it('should return user without password for valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'correctpassword');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        isActive: true,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', 'hashedPassword123');
    });
  });

  describe('login', () => {
    const mockUserWithoutPassword = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      isAdmin: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate access and refresh tokens', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_TOKEN_EXPIRATION') return '1h';
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '7d';
        return null;
      });
      mockJwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = await service.login(mockUserWithoutPassword);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          isAdmin: false,
        },
      });

      // Verify JWT sign was called with correct payload
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        {
          sub: 1,
          username: 'testuser',
          isAdmin: false,
        },
        { expiresIn: '1h' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        {
          sub: 1,
          username: 'testuser',
          isAdmin: false,
        },
        { expiresIn: '7d' },
      );
    });

    it('should use default token expiration if not configured', async () => {
      mockConfigService.get.mockReturnValue(null);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      await service.login(mockUserWithoutPassword);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        { expiresIn: '1h' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        { expiresIn: '7d' },
      );
    });

    it('should include admin status in token for admin user', async () => {
      const adminUser = { ...mockUserWithoutPassword, isAdmin: true };
      mockConfigService.get.mockReturnValue('1h');
      mockJwtService.sign.mockReturnValue('token');

      await service.login(adminUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
        expect.any(Object),
      );
    });
  });

  describe('verifyToken', () => {
    it('should return decoded payload for valid token', async () => {
      const mockPayload = {
        sub: 1,
        username: 'testuser',
        isAdmin: false,
      };
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(service.verifyToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshAccessToken', () => {
    const mockPayload = {
      sub: 1,
      username: 'testuser',
      isAdmin: false,
    };

    const mockUser = {
      id: 1,
      username: 'testuser',
      password: 'hashedPassword',
      email: 'test@example.com',
      isAdmin: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate new access token for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue('1h');
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: 1,
          username: 'testuser',
          isAdmin: false,
        },
        { expiresIn: '1h' },
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken('refresh-token')).rejects.toThrow(
        'User not found or inactive',
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.refreshAccessToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken('refresh-token')).rejects.toThrow(
        'User not found or inactive',
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update admin status in new token if user became admin', async () => {
      mockJwtService.verify.mockReturnValue({ ...mockPayload, isAdmin: false });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isAdmin: true,
      });
      mockConfigService.get.mockReturnValue('1h');
      mockJwtService.sign.mockReturnValue('new-token');

      await service.refreshAccessToken('refresh-token');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
        expect.any(Object),
      );
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt with 10 salt rounds', async () => {
      const plainPassword = 'myPassword123';
      const hashedPassword = 'hashed_password_value';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(plainPassword);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
    });

    it('should return different hashes for same password (due to salt)', async () => {
      (bcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2');

      const hash1 = await service.hashPassword('password');
      const hash2 = await service.hashPassword('password');

      // In real bcrypt, hashes would be different due to salt
      // Here we're just verifying the mock behavior
      expect(hash1).not.toBe(hash2);
    });
  });
});
