# Restoration Shop ERP

Full-stack ERP system for automotive restoration shops.

## Features

- **Project Management**: Track restoration projects from estimate to delivery
- **Time Tracking**: Timer-based and manual time entry with phase assignment
- **Inventory Management**: Flat SKU inventory with reorder alerts
- **Parts Consumption**: Approval workflow for parts usage
- **Special Orders**: Purchase order tracking and delivery confirmation
- **Progress Billing**: Itemized invoicing with labor, parts, and special orders
- **Customer Portal**: Read-only access for customers to view progress and invoices
- **Role-Based Access**: 6 roles + 1 customer role with granular permissions
- **Reporting**: Job profitability, technician utilization, inventory valuation

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js (email/password, Google OAuth, magic-link)
- **Deployment**: Docker Compose (Nginx, Node.js, PostgreSQL)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd restoration-erp
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your database credentials and other settings.

4. Set up the database
```bash
npx prisma migrate dev
npm run db:seed
```

5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Default Credentials

After running the seed script:

- **Admin**: admin@restoration-erp.com / admin123
- **Shop Manager**: manager@restoration-erp.com / manager123
- **Technician**: tech@restoration-erp.com / tech123

## Docker Deployment

### Development with Docker Compose

```bash
docker-compose up -d
```

### Production Build

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Project Structure

```
restoration-erp/
├── app/
│   ├── (dashboard)/        # Dashboard routes
│   ├── api/                # API routes
│   └── auth/               # Authentication pages
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   └── providers/          # Context providers
├── lib/                    # Utilities and helpers
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed data
└── public/                 # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Roles and Permissions

- **Admin**: Full system access
- **Shop Manager**: Project management, approvals, reporting
- **Parts Manager**: Inventory management, special orders
- **Technician**: Time tracking, parts consumption
- **Front Desk**: Customer management, estimates, invoicing
- **Customer**: Portal access to view progress and invoices

## License

Proprietary - All rights reserved
