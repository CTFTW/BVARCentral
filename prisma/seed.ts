import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.shopSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", defaultShopRate: 95.0, companyName: "Restoration Shop" },
  });

  const adminPassword = await bcrypt.hash("ChangeMe123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      passwordHash: adminPassword,
      active: true,
    },
  });

  const managerPassword = await bcrypt.hash("ChangeMe123!", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      name: "Shop Manager",
      role: "SHOP_MANAGER",
      passwordHash: managerPassword,
      active: true,
    },
  });

  const partsManagerPassword = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email: "parts@example.com" },
    update: {},
    create: {
      email: "parts@example.com",
      name: "Parts Manager",
      role: "PARTS_MANAGER",
      passwordHash: partsManagerPassword,
      active: true,
    },
  });

  const techPassword = await bcrypt.hash("ChangeMe123!", 10);
  const tech = await prisma.user.upsert({
    where: { email: "tech@example.com" },
    update: {},
    create: {
      email: "tech@example.com",
      name: "Technician",
      role: "TECHNICIAN",
      passwordHash: techPassword,
      active: true,
    },
  });

  const frontDeskPassword = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email: "frontdesk@example.com" },
    update: {},
    create: {
      email: "frontdesk@example.com",
      name: "Front Desk",
      role: "FRONT_DESK",
      passwordHash: frontDeskPassword,
      active: true,
    },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      name: "Sample Customer",
      role: "CUSTOMER",
      active: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      name: "Sample Customer",
      email: "customer@example.com",
      phone: "555-0100",
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      customerId: customer.id,
      year: 1969,
      make: "Chevrolet",
      model: "Camaro",
      color: "Rally Green",
    },
  });

  const project = await prisma.project.create({
    data: {
      vehicleId: vehicle.id,
      name: "Full Restoration - 1969 Camaro",
      status: "ACTIVE",
      startDate: new Date(),
      phases: {
        create: [
          { name: "Teardown & Assessment", sequence: 1, status: "COMPLETED", assignedTechId: tech.id },
          { name: "Bodywork & Paint", sequence: 2, status: "IN_PROGRESS", assignedTechId: tech.id },
          { name: "Mechanical Rebuild", sequence: 3, status: "NOT_STARTED" },
          { name: "Interior & Final Assembly", sequence: 4, status: "NOT_STARTED" },
        ],
      },
    },
    include: { phases: true },
  });

  await prisma.part.upsert({
    where: { sku: "PNT-0001" },
    update: {},
    create: {
      sku: "PNT-0001",
      description: "Rally Green Base Coat (Gallon)",
      costPrice: 85.0,
      sellingPrice: 140.0,
      quantityOnHand: 12,
      reorderThreshold: 4,
      location: "Paint Locker A1",
    },
  });

  await prisma.part.upsert({
    where: { sku: "SUS-0042" },
    update: {},
    create: {
      sku: "SUS-0042",
      description: "Front Suspension Bushing Kit",
      costPrice: 32.5,
      sellingPrice: 59.99,
      quantityOnHand: 6,
      reorderThreshold: 2,
      location: "Bin C3",
    },
  });

  console.log("Seed complete.");
  console.log({ admin: admin.email, manager: manager.email, project: project.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
