import { NextResponse } from "next/server";

import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    enabled: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
}
