import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

// Daily safety net: releases missed pickups, promotes the waitlist, sends reminders.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMaintenance(true));
}
