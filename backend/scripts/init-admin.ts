/**
 * Initialize Admin User Script
 * Creates a default admin user for initial setup
 *
 * Usage: npx tsx scripts/init-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Initializing admin user...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('⚠️  Admin user already exists. Skipping...');
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      isAdmin: true,
      isActive: true,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('📋 Credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('   Email: admin@example.com');
  console.log('');
  console.log('⚠️  Please change the password after first login!');
}

main()
  .catch((error) => {
    console.error('❌ Error initializing admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
