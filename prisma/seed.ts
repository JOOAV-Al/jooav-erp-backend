import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Argon2 options - same as auth service
const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

// Hash password using Argon2
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argonOptions);
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Super Admin user
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@jooav.com' },
    update: {},
    create: {
      email: 'superadmin@jooav.com',
      firstName: 'Super',
      lastName: 'Admin',
      password: await hashPassword('password123'), // Argon2 hashed
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'Platform Super Administrator',
          country: 'Nigeria',
        },
      },
      superAdminProfile: {
        create: {
          // Super Admin is platform owner - no regional restrictions
          canManageManufacturers: true,
          canApproveSMEs: true,
          canManageSubAdmins: true,
          canAccessAnalytics: true,
          canModifySystemConfig: true,
        },
      },
    },
  });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jooav.com' },
    update: {},
    create: {
      email: 'admin@jooav.com',
      firstName: 'Platform',
      lastName: 'Admin',
      password: await hashPassword('password123'), // Argon2 hashed
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'System Administrator',
          country: 'Nigeria',
        },
      },
      superAdminProfile: {
        create: {
          assignedRegions: ['Lagos', 'Abuja'], // Example regional assignment
          canManageManufacturers: true,
          canApproveSMEs: true,
          canManageSubAdmins: false, // Limited permissions for regular admin
          canAccessAnalytics: true,
          canModifySystemConfig: false,
        },
      },
    },
  });

  // Create sample users
  const subAdmin = await prisma.user.upsert({
    where: { email: 'subadmin@jooav.com' },
    update: {},
    create: {
      email: 'subadmin@jooav.com',
      firstName: 'Regional',
      lastName: 'Officer',
      password: await hashPassword('password123'), // Argon2 hashed
      role: UserRole.SUB_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'Regional Procurement Officer',
          country: 'Nigeria',
        },
      },
      subAdminProfile: {
        create: {
          employeeId: 'SUB001',
          // regionId: undefined, // Optional - can be assigned later for scalability
          specializations: ['Electronics', 'Industrial Equipment'],
          maxOrderValue: 50000.0,
        },
      },
    },
  });

  // Create SME user
  const smeUser = await prisma.user.upsert({
    where: { email: 'sme@jooav.com' },
    update: {},
    create: {
      email: 'sme@jooav.com',
      firstName: 'Small Business',
      lastName: 'Owner',
      password: await hashPassword('password123'), // Argon2 hashed
      role: UserRole.SME_USER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'Small Business Owner',
          country: 'Nigeria',
        },
      },
    },
  });

  // Create sample customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyName: 'Tech Solutions Ltd',
        contactName: 'Alice Johnson',
        email: 'alice@techsolutions.com',
        phone: '+234-801-234-5678',
        address: '123 Business District',
        city: 'Lagos',
        country: 'Nigeria',
      },
    }),
    prisma.customer.create({
      data: {
        companyName: 'Global Enterprises',
        contactName: 'Bob Smith',
        email: 'bob@globalenterprises.com',
        phone: '+234-802-345-6789',
        address: '456 Corporate Avenue',
        city: 'Abuja',
        country: 'Nigeria',
      },
    }),
  ]);

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Laptop Computer',
        description: 'High-performance business laptop',
        sku: 'LAP-001',
        barcode: '1234567890123',
        category: 'Electronics',
        price: 150000.0,
        costPrice: 120000.0,
        stock: 50,
        minStock: 10,
        images: ['laptop1.jpg', 'laptop2.jpg'],
      },
    }),
    prisma.product.create({
      data: {
        name: 'Office Chair',
        description: 'Ergonomic office chair with lumbar support',
        sku: 'CHR-001',
        barcode: '2345678901234',
        category: 'Furniture',
        price: 45000.0,
        costPrice: 35000.0,
        stock: 25,
        minStock: 5,
        images: ['chair1.jpg', 'chair2.jpg'],
      },
    }),
    prisma.product.create({
      data: {
        name: 'Wireless Mouse',
        description: 'Bluetooth wireless mouse',
        sku: 'MSE-001',
        barcode: '3456789012345',
        category: 'Electronics',
        price: 8000.0,
        costPrice: 6000.0,
        stock: 100,
        minStock: 20,
        images: ['mouse1.jpg'],
      },
    }),
  ]);

  // Create sample projects
  const project = await prisma.project.create({
    data: {
      name: 'ERP System Implementation',
      description:
        'Implementation of the new ERP system for business operations',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      budget: 500000.0,
      tasks: {
        create: [
          {
            title: 'Setup Database',
            description: 'Configure and setup the production database',
            assignedId: subAdmin.id,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
          {
            title: 'Develop User Interface',
            description: 'Create responsive user interface for the application',
            assignedId: subAdmin.id,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
        ],
      },
    },
  });

  // Create system configurations
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'company_name',
        value: JSON.stringify('JOOAV Technologies'),
      },
      {
        key: 'company_email',
        value: JSON.stringify('info@jooav.com'),
      },
      {
        key: 'company_phone',
        value: JSON.stringify('+234-800-JOOAV-01'),
      },
      {
        key: 'default_currency',
        value: JSON.stringify('NGN'),
      },
      {
        key: 'tax_rate',
        value: JSON.stringify(7.5),
      },
    ],
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('📊 Seeded data:');
  console.log(
    `   - ${4} Users (1 Super Admin, 1 Admin, 1 Sub-Admin, 1 SME User)`,
  );
  console.log(`   - ${customers.length} Customers`);
  console.log(`   - ${products.length} Products`);
  console.log(`   - ${1} Project with ${2} Tasks`);
  console.log(`   - ${5} System Configurations`);
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
