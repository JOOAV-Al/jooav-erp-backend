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

  // Collect users for easy reference
  const users = [superAdmin, admin, subAdmin, smeUser];

  // Create sample manufacturers
  const manufacturers = await Promise.all([
    prisma.manufacturer.create({
      data: {
        name: 'Nestle Nigeria Plc',
        description: 'Leading food and beverage company',
        email: 'info@nestle.com.ng',
        phone: '+234-1-280-0000',
        website: 'https://www.nestle-cwa.com/en/nestle-nigeria',
        address: '22-24 Industrial Avenue, Ilupeju',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001',
        registrationNumber: 'RC123456',
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.manufacturer.create({
      data: {
        name: 'Coca-Cola Nigeria Limited',
        description: 'The Coca-Cola System in Nigeria',
        email: 'info@coca-colanigeria.com',
        phone: '+234-1-271-5151',
        website: 'https://www.coca-colanigeria.com',
        address: 'Coca-Cola Place, Lagos-Ibadan Expressway',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001',
        registrationNumber: 'RC789012',
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
  ]);

  // Create sample categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Food & Beverages',
        description: 'Food and beverage products',
        slug: 'food-beverages',
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Instant Noodles',
        description: 'Quick cooking noodles',
        slug: 'instant-noodles',
        parentId: null, // Will be set after creating the parent
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Soft Drinks',
        description: 'Carbonated and non-carbonated drinks',
        slug: 'soft-drinks',
        parentId: null, // Will be set after creating the parent
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Dairy Products',
        description: 'Milk and dairy products',
        slug: 'dairy-products',
        parentId: null, // Will be set after creating the parent
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
  ]);

  // Update subcategories with parent
  await prisma.category.update({
    where: { id: categories[1].id },
    data: { parentId: categories[0].id },
  });
  await prisma.category.update({
    where: { id: categories[2].id },
    data: { parentId: categories[0].id },
  });
  await prisma.category.update({
    where: { id: categories[3].id },
    data: { parentId: categories[0].id },
  });

  // Create sample brands
  const brands = await Promise.all([
    prisma.brand.create({
      data: {
        name: 'Indomie',
        description: 'Popular instant noodles brand',
        manufacturerId: manufacturers[0].id,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Coca-Cola',
        description: 'World famous cola brand',
        manufacturerId: manufacturers[1].id,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Peak',
        description: 'Premium milk brand',
        manufacturerId: manufacturers[0].id,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    }),
  ]);

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Indomie Chicken Curry 70g (Single Pack)',
        description: 'Delicious instant noodles with chicken curry flavor',
        sku: 'INDOMIE-CHICKEN-CURRY-70G-SINGLE-PACK',
        barcode: '8901058005042',
        nafdacNumber: 'A1-1234',
        brandId: brands[0].id,
        manufacturerId: manufacturers[0].id,
        categoryId:
          categories.find((c) => c.name === 'Instant Noodles')?.id ||
          categories[0].id,
        variant: 'Chicken Curry',
        packSize: '70g',
        packagingType: 'Single Pack',
        price: 120.0,
        images: ['indomie-chicken.jpg'],
        createdBy: users[0].id,
        updatedBy: users[0].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Coca Cola Classic 500ml (PET Bottle)',
        description: 'Refreshing cola soft drink',
        sku: 'COCA-COLA-CLASSIC-500ML-PET-BOTTLE',
        barcode: '5449000000996',
        brandId: brands[1].id,
        manufacturerId: manufacturers[1].id,
        categoryId:
          categories.find((c) => c.name === 'Soft Drinks')?.id ||
          categories[0].id,
        variant: 'Classic',
        packSize: '500ml',
        packagingType: 'PET Bottle',
        price: 200.0,
        images: ['coca-cola-500ml.jpg'],
        createdBy: users[0].id,
        updatedBy: users[0].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Peak Milk Powder 400g (Tin)',
        description: 'Premium quality milk powder for families',
        sku: 'PEAK-MILK-POWDER-400G-TIN',
        barcode: '8901058123456',
        nafdacNumber: 'A1-5678',
        brandId: brands.find((b) => b.name === 'Peak')?.id || brands[0].id,
        manufacturerId: manufacturers[0].id,
        categoryId:
          categories.find((c) => c.name === 'Dairy Products')?.id ||
          categories[0].id,
        variant: 'Milk Powder',
        packSize: '400g',
        packagingType: 'Tin',
        price: 1500.0,
        expiryDate: new Date('2025-12-31'),
        images: ['peak-milk-400g.jpg'],
        createdBy: users[0].id,
        updatedBy: users[0].id,
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
