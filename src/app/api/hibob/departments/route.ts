import { NextResponse } from "next/server";

import {
  HibobApiError,
  HibobConfigError,
  listDepartments,
} from "@/lib/hibob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const departments = await listDepartments();
    return NextResponse.json({ departments });
  } catch (err) {
    if (err instanceof HibobConfigError) {
      console.error("[api] /api/hibob/departments missing config", err.message);
      return NextResponse.json(
        { error: "HiBob is not configured on the server." },
        { status: 500 },
      );
    }
    if (err instanceof HibobApiError) {
      console.error("[api] /api/hibob/departments upstream failure", {
        status: err.status,
      });
      return NextResponse.json(
        { error: "HiBob request failed." },
        { status: 502 },
      );
    }
    console.error("[api] /api/hibob/departments unexpected error", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
