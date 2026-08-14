import { prisma } from "@rtcom/db";
import bcrypt from "bcryptjs";

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "9999999999";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const existing = await prisma.user.findUnique({
    where: { phone: adminPhone },
  });
  if (existing) {
    console.log(`Admin user already exists: ${adminPhone}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      name: "RTCOM Admin",
      phone: adminPhone,
      passwordHash,
      role: "ERP_ADMIN",
    },
  });
  console.log(`Created admin user ${admin.phone} (id: ${admin.id})`);
  console.log(
    "Set SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD env vars to customize; change this password after first login.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
