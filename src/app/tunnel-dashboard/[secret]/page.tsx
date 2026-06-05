import { notFound } from "next/navigation";
import { TunnelOperationsDashboard } from "@/components/TunnelOperationsDashboard";
import { getTunnelDashboardData } from "@/lib/tunnel-dashboard";

export default async function TunnelDashboardPage({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  const { secret } = await params;
  const data = await getTunnelDashboardData(secret);

  if (!data) {
    notFound();
  }

  return <TunnelOperationsDashboard data={data} />;
}
