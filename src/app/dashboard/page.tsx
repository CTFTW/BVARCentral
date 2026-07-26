import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  SHOP_MANAGER: "/dashboard/shop-manager",
  PARTS_MANAGER: "/dashboard/parts-manager",
  TECHNICIAN: "/dashboard/technician",
  FRONT_DESK: "/dashboard/front-desk",
  CUSTOMER: "/portal",
};

export default async function DashboardIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(ROLE_HOME[session.user.role] ?? "/login");
}
