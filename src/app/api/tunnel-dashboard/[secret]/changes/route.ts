import { NextResponse } from "next/server";
import { getTunnelDashboardLatestEventAt } from "@/lib/tunnel-dashboard";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  const latestEventAt = await getTunnelDashboardLatestEventAt(secret);

  if (latestEventAt === undefined) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const hasChanges =
    since !== null &&
    latestEventAt !== null &&
    new Date(latestEventAt).getTime() > new Date(since).getTime();

  return NextResponse.json({
    latestEventAt,
    hasChanges,
  });
}
