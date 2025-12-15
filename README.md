# JOOAV ERP Backend

A robust, scalable Enterprise Resource Planning (ERP) system built with NestJS, and PostgreSQL. This backend provides comprehensive business management capabilities including user management, customer relations, inventory management, order processing, and project management.

### Technical Features

- **Enterprise Architecture**: Modular, scalable design
- **Database**: PostgreSQL with Prisma ORM
- **API Documentation**: Swagger/OpenAPI integration
- **Security**: Helmet, CORS, rate limiting, input validation
- **Health Monitoring**: Built-in health checks and monitoring
- **Testing**: Comprehensive unit and integration tests
- **CI/CD Ready**: GitHub Actions workflows

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Yarn package manager

### Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd jooav-erp-backend
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Setup environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup local services**

   ```bash
   # Start PostgreSQL and Redis services
   yarn dev:services:start

   # Verify services are running
   yarn dev:services:check
   ```

5. **Setup development environment**

   ```bash
   yarn dev:setup
   ```

   This command will:
   - Verify database connection
   - Run database migrations
   - Seed initial data

6. **Start the application**
   ```bash
   yarn dev:start
   ```

The API will be available at:

- **API**: http://localhost:3000/api/v1
- **Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## 📊 Database

### Schema Management

```bash
# Generate Prisma client
yarn db:generate

# Create and apply migration
yarn db:migrate

# Deploy migrations (production)
yarn db:migrate:deploy

# Seed database
yarn db:seed

# Open Prisma Studio
yarn db:studio
```

## 🔐 Authentication System

Our comprehensive authentication system provides enterprise-grade security with JWT tokens, role-based access control, and session management.

### Features

- **JWT Authentication**: Access and refresh token system
- **Role-Based Access Control (RBAC)**: Multi-level user roles
- **Session Management**: Track and manage user sessions
- **Password Security**: Argon2 hashing with configurable rounds
- **Account Management**: Registration, login, password changes
- **Audit Logging**: Complete authentication event logging
- **Security Guards**: Route protection with role validation

### User Roles

- **SUPER_ADMIN**: Full system access and user management
- **ADMIN**: Administrative access with user management
- **MANAGER**: Management-level access to business functions
- **EMPLOYEE**: Standard user access to assigned functions
- **VIEWER**: Read-only access to authorized data

### Authentication Endpoints

#### Public Endpoints

```bash
# User Registration
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}

# User Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "securePassword123"
}

# Refresh Access Token
POST /api/v1/auth/refresh
{
  "refreshToken": "your-refresh-token"
}

# Forgot Password
POST /api/v1/auth/forgot-password
{
  "email": "user@example.com"
}

# Reset Password
POST /api/v1/auth/reset-password
{
  "token": "reset-token",
  "newPassword": "newSecurePassword123"
}
```

#### Protected Endpoints

```bash
# Get User Profile
GET /api/v1/auth/profile
Authorization: Bearer <access-token>

# Change Password
POST /api/v1/auth/change-password
Authorization: Bearer <access-token>
{
  "currentPassword": "currentPassword",
  "newPassword": "newSecurePassword123"
}

# Get User Sessions
GET /api/v1/auth/sessions
Authorization: Bearer <access-token>

# Logout Current Session
POST /api/v1/auth/logout
Authorization: Bearer <access-token>

# Logout All Sessions
POST /api/v1/auth/logout-all
Authorization: Bearer <access-token>
```

### User Management Endpoints

#### Admin Only Endpoints

```bash
# Get All Users (with pagination and filters)
GET /api/v1/users?page=1&limit=10&role=EMPLOYEE&status=ACTIVE
Authorization: Bearer <admin-token>

# Get User Statistics
GET /api/v1/users/stats
Authorization: Bearer <admin-token>

# Create New User
POST /api/v1/users
Authorization: Bearer <admin-token>
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "EMPLOYEE",
  "generatePassword": true
}

# Update User
PATCH /api/v1/users/:id
Authorization: Bearer <admin-token>

# Update User Status
PATCH /api/v1/users/:id/status
Authorization: Bearer <admin-token>
{
  "status": "INACTIVE"
}

# Update User Role (Super Admin only)
PATCH /api/v1/users/:id/role
Authorization: Bearer <super-admin-token>
{
  "role": "MANAGER"
}

# Delete User (Super Admin only)
DELETE /api/v1/users/:id
Authorization: Bearer <super-admin-token>
```

#### Self-Service Endpoints

```bash
# Get Own Profile
GET /api/v1/users/me/profile
Authorization: Bearer <access-token>

# Update Own Profile
PATCH /api/v1/users/me/profile
Authorization: Bearer <access-token>
{
  "firstName": "UpdatedName",
  "bio": "Updated bio"
}

# Update Profile Details
PATCH /api/v1/users/me/profile/details
Authorization: Bearer <access-token>
{
  "bio": "Software Developer",
  "phoneNumber": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "country": "USA"
}
```

### Default Users

After running the seed script, the following test users are available:

| Email             | Password    | Role        | Description          |
| ----------------- | ----------- | ----------- | -------------------- |
| admin@jooav.com   | password123 | SUPER_ADMIN | System Administrator |
| manager@jooav.com | password123 | MANAGER     | Operations Manager   |

### Security Configuration

Update your `.env` file with secure values:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Hashing
BCRYPT_ROUNDS=12

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

### Using Authentication in Your Code

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class ExampleController {
  @Get('protected')
  protectedRoute(@CurrentUser() user: User) {
    return { message: `Hello ${user.firstName}!` };
  }
}
```

## 🔒 Security Features

- **Helmet**: Security headers configuration
- **CORS**: Cross-origin resource sharing controls
- **Rate Limiting**: Request throttling protection
- **Input Validation**: Comprehensive request validation
- **JWT Authentication**: Secure token-based authentication (ready to implement)
- **Role-based Authorization**: Granular permission system

## 📚 API Documentation

The API is fully documented using Swagger/OpenAPI. Access the interactive documentation at:
`http://localhost:3000/api/docs`

### Key Endpoints

- `GET /api/v1/health` - Health check
- `GET /api/v1/users` - User management (coming soon)
- `GET /api/v1/customers` - Customer management (coming soon)
- `GET /api/v1/products` - Product catalog (coming soon)
- `GET /api/v1/orders` - Order processing (coming soon)
- `GET /api/v1/projects` - Project management (coming soon)

## 🧪 Testing

```bash
# Unit tests
yarn test

# Integration tests
yarn test:e2e

# Test coverage
yarn test:cov

# Watch mode
yarn test:watch
```

## 🔧 Development Scripts

```bash
# Development
yarn dev:start             # Start with hot reload
yarn start:debug           # Start with debugging
yarn dev:setup             # Complete development setup

# Local Services Management
yarn dev:services:start    # Start PostgreSQL and Redis
yarn dev:services:stop     # Stop PostgreSQL and Redis
yarn dev:services:check    # Check services status

# Building
yarn build                 # Build for production
yarn start:prod            # Start production build

# Code Quality
yarn lint                  # Check linting
yarn format                # Format code
yarn typecheck             # TypeScript checking

# Database
yarn db:generate           # Generate Prisma client
yarn db:migrate            # Create migration
yarn db:seed               # Seed database
yarn db:studio             # Open Prisma Studio


# Utilities
yarn health:check          # Health check
```

## 🏗️ Architecture

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── dto/            # Data transfer objects
│   ├── enums/          # Enumerations
│   ├── filters/        # Exception filters
│   ├── guards/         # Authentication guards
│   ├── interceptors/   # Request/response interceptors
│   ├── pipes/          # Validation pipes
│   └── utils/          # Utility functions
├── config/             # Configuration management
├── database/           # Database setup and utilities
├── modules/            # Feature modules
├── shared/             # Shared resources
└── health/             # Health check endpoints
```

## 🌍 Environment Configuration

Key environment variables:

```env
# Database (Local PostgreSQL)
DATABASE_URL=postgresql://jooav:password@localhost:5432/jooav_erp_dev

# Redis (Local Redis)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_VERSION=v1

# Security
JWT_SECRET=your-super-secret-jwt-key
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# Sentry Error Tracking
SENTRY_DSN=your-sentry-dsn-here

# Cloudinary File Upload
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Documentation
SWAGGER_TITLE="JOOAV ERP API"
SWAGGER_VERSION="1.0"
```

## 🚀 Production Deployment

1. **Build the application**

   ```bash
   yarn build
   ```

2. **Setup production database**

   ```bash
   yarn db:migrate:deploy
   yarn db:seed
   ```

3. **Start the application**
   ```bash
   yarn start:prod
   ```

## 📈 Monitoring & Health Checks

The application includes comprehensive health monitoring:

- **Health Endpoint**: `/api/v1/health` - Overall application health
- **Readiness Probe**: `/api/v1/health/ready` - Application readiness
- **Liveness Probe**: `/api/v1/health/live` - Application liveness
- **Database Health**: Automatic database connection monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow conventional commits
- Ensure security best practices

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using NestJS, Prisma, and PostgreSQL.

  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Run tests

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
