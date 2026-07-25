import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting database seed...")

  const adminPassword = await bcrypt.hash("admin123", 10)
  
  const admin = await prisma.user.upsert({
    where: { email: "admin@restoration-erp.com" },
    update: {},
    create: {
      email: "admin@restoration-erp.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  })

  console.log("Created admin user:", admin.email)

  const shopManagerPassword = await bcrypt.hash("manager123", 10)
  
  const shopManager = await prisma.user.upsert({
    where: { email: "manager@restoration-erp.com" },
    update: {},
    create: {
      email: "manager@restoration-erp.com",
      name: "Shop Manager",
      passwordHash: shopManagerPassword,
      role: "SHOP_MANAGER",
    },
  })

  console.log("Created shop manager:", shopManager.email)

  const techPassword = await bcrypt.hash("tech123", 10)
  
  const technician = await prisma.user.upsert({
    where: { email: "tech@restoration-erp.com" },
    update: {},
    create: {
      email: "tech@restoration-erp.com",
      name: "John Technician",
      passwordHash: techPassword,
      role: "TECHNICIAN",
    },
  })

  console.log("Created technician:", technician.email)

  await prisma.systemSetting.upsert({
    where: { key: "shop_rate" },
    update: { value: "125.00" },
    create: { key: "shop_rate", value: "125.00" },
  })

  console.log("Set default shop rate: $125.00/hour")

  const sampleCustomer = await prisma.customer.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "John Smith",
      email: "customer@example.com",
      phone: "555-0100",
      address: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    },
  })

  console.log("Created sample customer:", sampleCustomer.name)

  const sampleVehicle = await prisma.vehicle.upsert({
    where: { vin: "1HGCM82633A004352" },
    update: {},
    create: {
      customerId: sampleCustomer.id,
      year: 1967,
      make: "Ford",
      model: "Mustang",
      vin: "1HGCM82633A004352",
      licensePlate: "MUST67",
      color: "Red",
    },
  })

  console.log("Created sample vehicle:", `${sampleVehicle.year} ${sampleVehicle.make} ${sampleVehicle.model}`)

  const sampleParts = [
    { sku: "OIL-001", description: "Engine Oil 10W-30", category: "Fluids", costPrice: 15.99, sellingPrice: 24.99, quantity: 50, reorderThreshold: 10 },
    { sku: "FILT-001", description: "Oil Filter", category: "Filters", costPrice: 8.50, sellingPrice: 14.99, quantity: 30, reorderThreshold: 5 },
    { sku: "BRAK-001", description: "Brake Pads (Front)", category: "Brakes", costPrice: 45.00, sellingPrice: 79.99, quantity: 20, reorderThreshold: 5 },
    { sku: "SPRK-001", description: "Spark Plugs (Set of 8)", category: "Ignition", costPrice: 32.00, sellingPrice: 54.99, quantity: 15, reorderThreshold: 3 },
  ]

  for (const part of sampleParts) {
    await prisma.part.upsert({
      where: { sku: part.sku },
      update: {},
      create: part,
    })
  }

  console.log("Created sample inventory parts")

  console.log("Database seeded successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
