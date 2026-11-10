import { NextResponse } from "next/server";
import { getServerConfigStatus } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfigStatus();
  return NextResponse.json({
    status: "online",
    config,
    timestamp: new Date().toISOString(),
  });
}
