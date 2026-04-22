import { NextResponse } from "next/server";
import { z } from "zod";

import {
  HibobApiError,
  HibobConfigError,
  listEmployeesByDepartments,
} from "@/lib/hibob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  departments: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one department.")
    .max(50, "Too many departments in one request."),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const employees = await listEmployeesByDepartments(parsed.data.departments);
    return NextResponse.json({ employees });
  } catch (err) {
    if (err instanceof HibobConfigError) {
      console.error("[api] /api/hibob/employees missing config", err.message);
      return NextResponse.json(
        { error: "HiBob is not configured on the server." },
        { status: 500 },
      );
    }
    if (err instanceof HibobApiError) {
      console.error("[api] /api/hibob/employees upstream failure", {
        status: err.status,
      });
      return NextResponse.json(
        { error: "HiBob request failed." },
        { status: 502 },
      );
    }
    console.error("[api] /api/hibob/employees unexpected error", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
