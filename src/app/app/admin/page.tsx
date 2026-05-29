import { AdminDemoClient } from "@/components/AdminDemoClient";
import { AppShell } from "@/components/AppShell";

export default function AdminSeedPage() {
  return (
    <AppShell active="dashboard">
      <AdminDemoClient />
    </AppShell>
  );
}
