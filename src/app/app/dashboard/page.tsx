import { AppShell } from "@/components/AppShell";
import { CoachDashboardClient } from "@/components/CoachDashboardClient";

export default function CoachDashboardPage() {
  return (
    <AppShell active="dashboard">
      <CoachDashboardClient />
    </AppShell>
  );
}
