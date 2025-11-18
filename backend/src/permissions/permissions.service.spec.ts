import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    roleJobPermission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPermissions', () => {
    it('should return empty permissions for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserPermissions(999);

      expect(result).toEqual({ isAdmin: false, permissions: [] });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: { isAdmin: true },
      });
    });

    it('should return admin status with empty permissions for admin user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });

      const result = await service.getUserPermissions(1);

      expect(result).toEqual({ isAdmin: true, permissions: [] });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { isAdmin: true },
      });
      // Should not query role permissions for admin
      expect(prisma.roleJobPermission.findMany).not.toHaveBeenCalled();
    });

    it('should return empty permissions for regular user with no roles', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([]);

      const result = await service.getUserPermissions(2);

      expect(result).toEqual({ isAdmin: false, permissions: [] });
    });

    it('should return permissions for user with single role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        {
          jobId: 1,
          appName: 'test-app',
          canView: true,
          canExecute: false,
          canEdit: false,
        },
        {
          jobId: 2,
          appName: 'test-app',
          canView: true,
          canExecute: true,
          canEdit: false,
        },
      ]);

      const result = await service.getUserPermissions(2);

      expect(result.isAdmin).toBe(false);
      expect(result.permissions).toHaveLength(2);
      expect(result.permissions).toEqual(
        expect.arrayContaining([
          {
            jobId: 1,
            appName: 'test-app',
            canView: true,
            canExecute: false,
            canEdit: false,
          },
          {
            jobId: 2,
            appName: 'test-app',
            canView: true,
            canExecute: true,
            canEdit: false,
          },
        ]),
      );
    });

    it('should merge permissions using OR logic for same job from multiple roles', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      // Simulating user having 2 roles with different permissions for same job
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        // Role 1: can only view job 1
        {
          jobId: 1,
          appName: 'test-app',
          canView: true,
          canExecute: false,
          canEdit: false,
        },
        // Role 2: can execute job 1 (but not view)
        {
          jobId: 1,
          appName: 'test-app',
          canView: false,
          canExecute: true,
          canEdit: false,
        },
        // Role 1: can edit job 1 (but not view or execute)
        {
          jobId: 1,
          appName: 'test-app',
          canView: false,
          canExecute: false,
          canEdit: true,
        },
      ]);

      const result = await service.getUserPermissions(3);

      expect(result.isAdmin).toBe(false);
      expect(result.permissions).toHaveLength(1);
      // OR merge: user should have all permissions for job 1
      expect(result.permissions[0]).toEqual({
        jobId: 1,
        appName: 'test-app',
        canView: true,
        canExecute: true,
        canEdit: true,
      });
    });

    it('should handle multiple jobs with OR merge logic correctly', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        // Job 1 - Role A
        { jobId: 1, appName: 'app1', canView: true, canExecute: false, canEdit: false },
        // Job 1 - Role B
        { jobId: 1, appName: 'app1', canView: false, canExecute: true, canEdit: false },
        // Job 2 - Role A
        { jobId: 2, appName: 'app2', canView: true, canExecute: true, canEdit: false },
        // Job 2 - Role B
        { jobId: 2, appName: 'app2', canView: false, canExecute: false, canEdit: true },
      ]);

      const result = await service.getUserPermissions(4);

      expect(result.isAdmin).toBe(false);
      expect(result.permissions).toHaveLength(2);

      const job1Perm = result.permissions.find((p) => p.jobId === 1);
      expect(job1Perm).toEqual({
        jobId: 1,
        appName: 'app1',
        canView: true,
        canExecute: true,
        canEdit: false,
      });

      const job2Perm = result.permissions.find((p) => p.jobId === 2);
      expect(job2Perm).toEqual({
        jobId: 2,
        appName: 'app2',
        canView: true,
        canExecute: true,
        canEdit: true,
      });
    });
  });

  describe('hasJobPermission', () => {
    it('should return false for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.hasJobPermission(999, 1, 'view');

      expect(result).toBe(false);
    });

    it('should return false for inactive user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: false,
      });

      const result = await service.hasJobPermission(1, 1, 'view');

      expect(result).toBe(false);
    });

    it('should return true for admin user regardless of role permissions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: true,
        isActive: true,
      });

      const result = await service.hasJobPermission(1, 1, 'execute');

      expect(result).toBe(true);
      // Should not query role permissions for admin
      expect(prisma.roleJobPermission.count).not.toHaveBeenCalled();
    });

    it('should return true when user has view permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: true,
      });
      mockPrismaService.roleJobPermission.count.mockResolvedValue(1);

      const result = await service.hasJobPermission(2, 1, 'view');

      expect(result).toBe(true);
      expect(prisma.roleJobPermission.count).toHaveBeenCalledWith({
        where: {
          jobId: 1,
          role: {
            users: {
              some: {
                userId: 2,
              },
            },
          },
          canView: true,
        },
      });
    });

    it('should return true when user has execute permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: true,
      });
      mockPrismaService.roleJobPermission.count.mockResolvedValue(1);

      const result = await service.hasJobPermission(2, 1, 'execute');

      expect(result).toBe(true);
      expect(prisma.roleJobPermission.count).toHaveBeenCalledWith({
        where: {
          jobId: 1,
          role: {
            users: {
              some: {
                userId: 2,
              },
            },
          },
          canExecute: true,
        },
      });
    });

    it('should return true when user has edit permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: true,
      });
      mockPrismaService.roleJobPermission.count.mockResolvedValue(1);

      const result = await service.hasJobPermission(2, 1, 'edit');

      expect(result).toBe(true);
      expect(prisma.roleJobPermission.count).toHaveBeenCalledWith({
        where: {
          jobId: 1,
          role: {
            users: {
              some: {
                userId: 2,
              },
            },
          },
          canEdit: true,
        },
      });
    });

    it('should return false when user has no permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: true,
      });
      mockPrismaService.roleJobPermission.count.mockResolvedValue(0);

      const result = await service.hasJobPermission(2, 1, 'execute');

      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for active admin user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: true,
        isActive: true,
      });

      const result = await service.isAdmin(1);

      expect(result).toBe(true);
    });

    it('should return false for inactive admin user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: true,
        isActive: false,
      });

      const result = await service.isAdmin(1);

      expect(result).toBe(false);
    });

    it('should return false for non-admin user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isAdmin: false,
        isActive: true,
      });

      const result = await service.isAdmin(2);

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.isAdmin(999);

      expect(result).toBe(false);
    });
  });

  describe('getUserAccessibleJobs', () => {
    it('should return empty array for admin (signaling all jobs)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });

      const result = await service.getUserAccessibleJobs(1);

      expect(result).toEqual([]);
    });

    it('should return job IDs where user has view permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        { jobId: 1, appName: 'app1', canView: true, canExecute: false, canEdit: false },
        { jobId: 2, appName: 'app2', canView: false, canExecute: true, canEdit: false },
        { jobId: 3, appName: 'app3', canView: true, canExecute: true, canEdit: true },
      ]);

      const result = await service.getUserAccessibleJobs(2);

      // Only jobs 1 and 3 have view permission
      expect(result).toEqual(expect.arrayContaining([1, 3]));
      expect(result).toHaveLength(2);
    });

    it('should return empty array for user with no view permissions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        { jobId: 1, appName: 'app1', canView: false, canExecute: true, canEdit: false },
      ]);

      const result = await service.getUserAccessibleJobs(2);

      expect(result).toEqual([]);
    });
  });

  describe('batchCheckPermissions', () => {
    it('should return all permissions true for admin user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });

      const result = await service.batchCheckPermissions(1, [1, 2, 3]);

      expect(result.size).toBe(3);
      expect(result.get(1)).toEqual({ canView: true, canExecute: true, canEdit: true });
      expect(result.get(2)).toEqual({ canView: true, canExecute: true, canEdit: true });
      expect(result.get(3)).toEqual({ canView: true, canExecute: true, canEdit: true });
    });

    it('should return correct permissions for regular user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([
        { jobId: 1, appName: 'app1', canView: true, canExecute: false, canEdit: false },
        { jobId: 2, appName: 'app2', canView: true, canExecute: true, canEdit: false },
      ]);

      const result = await service.batchCheckPermissions(2, [1, 2, 3]);

      expect(result.size).toBe(3);
      expect(result.get(1)).toEqual({ canView: true, canExecute: false, canEdit: false });
      expect(result.get(2)).toEqual({ canView: true, canExecute: true, canEdit: false });
      // Job 3 has no permissions
      expect(result.get(3)).toEqual({ canView: false, canExecute: false, canEdit: false });
    });

    it('should return all false permissions for jobs user has no access to', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.roleJobPermission.findMany.mockResolvedValue([]);

      const result = await service.batchCheckPermissions(2, [1, 2]);

      expect(result.size).toBe(2);
      expect(result.get(1)).toEqual({ canView: false, canExecute: false, canEdit: false });
      expect(result.get(2)).toEqual({ canView: false, canExecute: false, canEdit: false });
    });
  });
});
