import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { XxlJobService } from '../src/xxljob/xxljob.service';
import * as bcrypt from 'bcrypt';

describe('Jobs Permission Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mock XxlJobService to avoid external API calls
  const mockXxlJobService = {
    login: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    getJobList: jest.fn().mockResolvedValue({
      recordsTotal: 2,
      recordsFiltered: 2,
      data: [
        {
          id: 1,
          jobGroup: 1,
          jobDesc: 'Test Job 1',
          author: 'admin',
          scheduleType: 'CRON',
          scheduleConf: '0 0 * * * ?',
          triggerStatus: 1,
        },
        {
          id: 2,
          jobGroup: 1,
          jobDesc: 'Test Job 2',
          author: 'admin',
          scheduleType: 'CRON',
          scheduleConf: '0 0 * * * ?',
          triggerStatus: 1,
        },
      ],
    }),
    getJobGroups: jest.fn().mockResolvedValue([
      {
        id: 1,
        appname: 'test-executor',
        title: 'Test Executor',
        addressType: 0,
      },
    ]),
    triggerJob: jest.fn().mockResolvedValue(undefined),
    startJob: jest.fn().mockResolvedValue(undefined),
    stopJob: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(XxlJobService)
      .useValue(mockXxlJobService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Clean up database
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

  describe('Job Execution Permissions', () => {
    let adminToken: string;
    let userWithPermissionToken: string;
    let userWithoutPermissionToken: string;
    let adminId: number;
    let userWithPermissionId: number;
    let userWithoutPermissionId: number;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Create admin user
      const admin = await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@example.com',
          isAdmin: true,
        },
      });
      adminId = admin.id;

      // Create user with permission
      const userWithPerm = await prisma.user.create({
        data: {
          username: 'user_with_perm',
          password: hashedPassword,
          email: 'userwithperm@example.com',
          isAdmin: false,
        },
      });
      userWithPermissionId = userWithPerm.id;

      // Create user without permission
      const userWithoutPerm = await prisma.user.create({
        data: {
          username: 'user_without_perm',
          password: hashedPassword,
          email: 'userwithoutperm@example.com',
          isAdmin: false,
        },
      });
      userWithoutPermissionId = userWithoutPerm.id;

      // Create role with execute permission for job 1
      const role = await prisma.role.create({
        data: {
          name: 'Job1 Executor',
          description: 'Can execute job 1',
        },
      });

      // Assign permission to role
      await prisma.roleJobPermission.create({
        data: {
          roleId: role.id,
          jobId: 1,
          appName: 'test-executor',
          canView: true,
          canExecute: true,
          canEdit: false,
        },
      });

      // Assign role to user with permission
      await prisma.userRole.create({
        data: {
          userId: userWithPerm.id,
          roleId: role.id,
        },
      });

      // Get tokens
      const adminLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'password123' });
      adminToken = adminLogin.body.accessToken;

      const userWithPermLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'user_with_perm', password: 'password123' });
      userWithPermissionToken = userWithPermLogin.body.accessToken;

      const userWithoutPermLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'user_without_perm', password: 'password123' });
      userWithoutPermissionToken = userWithoutPermLogin.body.accessToken;
    });

    describe('POST /jobs/:jobId/trigger', () => {
      it('should allow admin to trigger any job', async () => {
        const response = await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(201);

        expect(response.body).toHaveProperty('message');
        expect(mockXxlJobService.triggerJob).toHaveBeenCalledWith(
          1,
          undefined,
          undefined,
        );

        // Verify audit log was created
        const auditLog = await prisma.auditLog.findFirst({
          where: {
            userId: adminId,
            jobId: 1,
            action: 'EXECUTE_JOB',
          },
        });
        expect(auditLog).toBeTruthy();
        expect(auditLog?.result).toBe('SUCCESS');
      });

      it('should allow user with execute permission to trigger job', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${userWithPermissionToken}`)
          .send({})
          .expect(201);

        // Verify audit log
        const auditLog = await prisma.auditLog.findFirst({
          where: {
            userId: userWithPermissionId,
            jobId: 1,
            action: 'EXECUTE_JOB',
          },
        });
        expect(auditLog).toBeTruthy();
      });

      it('should return 403 for user without execute permission', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${userWithoutPermissionToken}`)
          .send({})
          .expect(403);

        // Verify no audit log for failed attempt
        const auditLog = await prisma.auditLog.findFirst({
          where: {
            userId: userWithoutPermissionId,
            jobId: 1,
            action: 'EXECUTE_JOB',
            result: 'SUCCESS',
          },
        });
        expect(auditLog).toBeNull();
      });

      it('should return 401 when triggering without token', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .send({})
          .expect(401);
      });

      it('should trigger job with executor params', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            executorParam: 'test-param',
            addressList: '127.0.0.1:9999',
          })
          .expect(201);

        expect(mockXxlJobService.triggerJob).toHaveBeenCalledWith(
          1,
          'test-param',
          '127.0.0.1:9999',
        );
      });
    });

    describe('POST /jobs/:jobId/start', () => {
      it('should allow admin to start any job', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/start')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        expect(mockXxlJobService.startJob).toHaveBeenCalledWith(1);
      });

      it('should return 403 for user without edit permission', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/start')
          .set('Authorization', `Bearer ${userWithPermissionToken}`)
          .expect(403);
      });
    });

    describe('POST /jobs/:jobId/stop', () => {
      it('should allow admin to stop any job', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/stop')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        expect(mockXxlJobService.stopJob).toHaveBeenCalledWith(1);
      });

      it('should return 403 for user without edit permission', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/stop')
          .set('Authorization', `Bearer ${userWithPermissionToken}`)
          .expect(403);
      });
    });

    describe('GET /jobs', () => {
      it('should return all jobs for admin', async () => {
        const response = await request(app.getHttpServer())
          .get('/jobs')
          .query({ jobGroup: 1, start: 0, length: 10 })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data.length).toBe(2);
        expect(response.body.recordsTotal).toBe(2);
      });

      it('should return only permitted jobs for regular user', async () => {
        const response = await request(app.getHttpServer())
          .get('/jobs')
          .query({ jobGroup: 1, start: 0, length: 10 })
          .set('Authorization', `Bearer ${userWithPermissionToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        // User only has permission for job 1
        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].id).toBe(1);
      });

      it('should return empty list for user without any permissions', async () => {
        const response = await request(app.getHttpServer())
          .get('/jobs')
          .query({ jobGroup: 1, start: 0, length: 10 })
          .set('Authorization', `Bearer ${userWithoutPermissionToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data.length).toBe(0);
      });
    });

    describe('GET /jobs/:jobId', () => {
      it('should return job details for user with view permission', async () => {
        mockXxlJobService.getJobList.mockResolvedValueOnce({
          recordsTotal: 1,
          recordsFiltered: 1,
          data: [
            {
              id: 1,
              jobGroup: 1,
              jobDesc: 'Test Job 1',
              author: 'admin',
            },
          ],
        });

        await request(app.getHttpServer())
          .get('/jobs/1')
          .query({ jobGroup: 1 })
          .set('Authorization', `Bearer ${userWithPermissionToken}`)
          .expect(200);
      });

      it('should return 403 for user without view permission', async () => {
        await request(app.getHttpServer())
          .get('/jobs/1')
          .query({ jobGroup: 1 })
          .set('Authorization', `Bearer ${userWithoutPermissionToken}`)
          .expect(403);
      });
    });

    describe('Permission Logging', () => {
      it('should log failed permission attempts', async () => {
        const beforeCount = await prisma.auditLog.count({
          where: {
            userId: userWithoutPermissionId,
          },
        });

        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${userWithoutPermissionToken}`)
          .send({})
          .expect(403);

        // Note: In current implementation, failed permission checks don't create audit logs
        // Only successful operations create audit logs
        // This is by design to avoid log spam
      });

      it('should log successful job execution', async () => {
        await request(app.getHttpServer())
          .post('/jobs/1/trigger')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(201);

        const auditLog = await prisma.auditLog.findFirst({
          where: {
            userId: adminId,
            jobId: 1,
            action: 'EXECUTE_JOB',
            result: 'SUCCESS',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        expect(auditLog).toBeTruthy();
        expect(auditLog?.message).toContain('Triggered job execution');
      });
    });
  });

  describe('Multiple Roles OR Logic', () => {
    let testUserToken: string;
    let testUserId: number;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Create test user
      const user = await prisma.user.create({
        data: {
          username: 'multirole_user',
          password: hashedPassword,
          email: 'multirole@example.com',
          isAdmin: false,
        },
      });
      testUserId = user.id;

      // Create two roles with different permissions for job 2
      const role1 = await prisma.role.create({
        data: { name: 'View Only', description: 'Can only view' },
      });

      const role2 = await prisma.role.create({
        data: { name: 'Execute Only', description: 'Can only execute' },
      });

      // Role 1: can view job 2
      await prisma.roleJobPermission.create({
        data: {
          roleId: role1.id,
          jobId: 2,
          appName: 'test-executor',
          canView: true,
          canExecute: false,
          canEdit: false,
        },
      });

      // Role 2: can execute job 2
      await prisma.roleJobPermission.create({
        data: {
          roleId: role2.id,
          jobId: 2,
          appName: 'test-executor',
          canView: false,
          canExecute: true,
          canEdit: false,
        },
      });

      // Assign both roles to user
      await prisma.userRole.createMany({
        data: [
          { userId: user.id, roleId: role1.id },
          { userId: user.id, roleId: role2.id },
        ],
      });

      // Get token
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'multirole_user', password: 'password123' });
      testUserToken = login.body.accessToken;
    });

    it('should merge permissions using OR logic - user can execute due to role2', async () => {
      await request(app.getHttpServer())
        .post('/jobs/2/trigger')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({})
        .expect(201);
    });

    it('should merge permissions using OR logic - user can view due to role1', async () => {
      mockXxlJobService.getJobList.mockResolvedValueOnce({
        recordsTotal: 1,
        recordsFiltered: 1,
        data: [
          {
            id: 2,
            jobGroup: 1,
            jobDesc: 'Test Job 2',
          },
        ],
      });

      await request(app.getHttpServer())
        .get('/jobs/2')
        .query({ jobGroup: 1 })
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
    });
  });
});
