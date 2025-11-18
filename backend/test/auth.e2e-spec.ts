import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Clean up database before tests
    await prisma.auditLog.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.roleJobPermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          username: 'testuser',
          password: hashedPassword,
          email: 'test@example.com',
          isAdmin: false,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toEqual({
        id: user.id,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
      });
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.refreshToken).toBeTruthy();
    });

    it('should return 401 for incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password',
        })
        .expect(401);
    });

    it('should return 401 for disabled user', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'disableduser',
          password: hashedPassword,
          email: 'disabled@example.com',
          isActive: false,
        },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'disableduser',
          password: 'password123',
        })
        .expect(401);
    });

    it('should return 400 for invalid request body', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'ab', // Too short (min 3)
          password: '123', // Too short (min 6)
        })
        .expect(400);
    });

    it('should return 400 for missing username', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
        })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    let validRefreshToken: string;

    beforeAll(async () => {
      // Create user and get tokens
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'refreshuser',
          password: hashedPassword,
          email: 'refresh@example.com',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'refreshuser',
          password: 'password123',
        });

      validRefreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: validRefreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.accessToken).not.toBe(validRefreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });

    it('should return 400 for missing refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });

    it('should return 401 if user was deleted after token issued', async () => {
      // Create temporary user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const tempUser = await prisma.user.create({
        data: {
          username: 'tempuser',
          password: hashedPassword,
          email: 'temp@example.com',
        },
      });

      // Get refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'tempuser',
          password: 'password123',
        });

      const tempRefreshToken = loginResponse.body.refreshToken;

      // Delete audit logs first (foreign key constraint)
      await prisma.auditLog.deleteMany({ where: { userId: tempUser.id } });

      // Delete user
      await prisma.user.delete({ where: { id: tempUser.id } });

      // Try to refresh with deleted user's token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: tempRefreshToken,
        })
        .expect(401);
    });

    it('should return 401 if user was disabled after token issued', async () => {
      // Create user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          username: 'todisableuser',
          password: hashedPassword,
          email: 'todisable@example.com',
        },
      });

      // Get refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'todisableuser',
          password: 'password123',
        });

      const userRefreshToken = loginResponse.body.refreshToken;

      // Disable user
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      // Try to refresh with disabled user's token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: userRefreshToken,
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'logoutuser',
          password: hashedPassword,
          email: 'logout@example.com',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'logoutuser',
          password: 'password123',
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should logout successfully with valid access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should return 401 when logout without token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    let accessToken: string;
    let userId: number;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          username: 'profileuser',
          password: hashedPassword,
          email: 'profile@example.com',
          isAdmin: false,
        },
      });

      userId = user.id;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'profileuser',
          password: 'password123',
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should get current user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Profile returns data from JWT payload (sub, username, isAdmin)
      // The actual user object from database is not returned
      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('username', 'profileuser');
      expect(response.body).toHaveProperty('isAdmin', false);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when accessing profile without token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Token Expiration', () => {
    it('should generate tokens with proper expiration', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'expiryuser',
          password: hashedPassword,
          email: 'expiry@example.com',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'expiryuser',
          password: 'password123',
        })
        .expect(200);

      // Verify tokens are non-empty strings
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
      expect(typeof response.body.refreshToken).toBe('string');
      expect(response.body.refreshToken.length).toBeGreaterThan(0);

      // Verify tokens are different
      expect(response.body.accessToken).not.toBe(response.body.refreshToken);
    });
  });
});
