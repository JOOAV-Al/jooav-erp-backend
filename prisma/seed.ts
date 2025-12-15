import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create super admin user
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@jooav.com' },
    update: {},
    create: {
      email: 'admin@jooav.com',
      firstName: 'Super',
      lastName: 'Admin',
      password: '$2b$12$LQv3c1yqBwlVHpPjrCyeNOHNMQBqx83KDQC0xc5L5F1s5W1B5o3gm', // Default: "password123"
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'System Administrator',
          country: 'Nigeria',
        },
      },
    },
  });

  // Create sample users
  const manager = await prisma.user.upsert({
    where: { email: 'manager@jooav.com' },
    update: {},
    create: {
      email: 'manager@jooav.com',
      firstName: 'John',
      lastName: 'Manager',
      password: '$2b$12$LQv3c1yqBwlVHpPjrCyeNOHNMQBqx83KDQC0xc5L5F1s5W1B5o3gm', // Default: "password123"
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          bio: 'Operations Manager',
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
            assignedId: manager.id,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
          {
            title: 'Develop User Interface',
            description: 'Create responsive user interface for the application',
            assignedId: manager.id,
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
  console.log(`   - ${2} Users (1 Super Admin, 1 Manager)`);
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
