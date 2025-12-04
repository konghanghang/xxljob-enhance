import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Database Seeder Service
 * Initializes database with default admin user and roles
 */
@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Run database seeding on module initialization
   */
  async onModuleInit() {
    const shouldSeed = this.configService.get<string>('DATABASE_SEED') !== 'false';

    if (!shouldSeed) {
      this.logger.log('Database seeding disabled by configuration');
      return;
    }

    try {
      await this.seedDatabase();
    } catch (error) {
      this.logger.error('Failed to seed database', error);
      // Don't throw - allow app to start even if seeding fails
    }
  }

  /**
   * Seed database with initial data
   */
  private async seedDatabase() {
    this.logger.log('Starting database seeding...');

    // Check if any users exist
    const userCount = await this.prisma.user.count();

    if (userCount > 0) {
      this.logger.log(`Database already has ${userCount} user(s), skipping seeding`);
      return;
    }

    // Get default admin credentials from environment
    const defaultAdminUsername = this.configService.get<string>('DEFAULT_ADMIN_USERNAME', 'admin');
    const defaultAdminPassword = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD', 'admin123');
    const defaultAdminEmail = this.configService.get<string>('DEFAULT_ADMIN_EMAIL');

    // Create default admin user
    this.logger.log(`Creating default admin user: ${defaultAdminUsername}`);

    const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);

    const adminUser = await this.prisma.user.create({
      data: {
        username: defaultAdminUsername,
        password: hashedPassword,
        email: defaultAdminEmail || null,
        isAdmin: true,
        isActive: true,
      },
    });

    this.logger.log(`✅ Default admin user created successfully (ID: ${adminUser.id})`);
    this.logger.warn(`⚠️  Default credentials - Username: ${defaultAdminUsername}, Password: ${defaultAdminPassword}`);
    this.logger.warn(`⚠️  Please change the default password immediately after first login!`);

    // Optionally create default roles
    await this.seedDefaultRoles();

    this.logger.log('Database seeding completed successfully');
  }

  /**
   * Create default roles if they don't exist
   */
  private async seedDefaultRoles() {
    const roleCount = await this.prisma.role.count();

    if (roleCount > 0) {
      this.logger.log('Roles already exist, skipping role seeding');
      return;
    }

    const defaultRoles = [
      {
        name: 'Admin',
        description: 'Full system access with all permissions',
      },
      {
        name: 'Developer',
        description: 'Can view and execute jobs',
      },
      {
        name: 'Viewer',
        description: 'Read-only access to view jobs',
      },
    ];

    this.logger.log(`Creating ${defaultRoles.length} default roles...`);

    for (const roleData of defaultRoles) {
      const role = await this.prisma.role.create({
        data: roleData,
      });
      this.logger.log(`  ✅ Created role: ${role.name}`);
    }
  }

  /**
   * Manual trigger for database seeding (can be called from admin endpoint)
   */
  async forceSeed() {
    this.logger.warn('Force seeding database (manual trigger)');
    await this.seedDatabase();
  }
}
