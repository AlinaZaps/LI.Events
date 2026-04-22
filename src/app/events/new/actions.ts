"use server";

import { randomBytes } from "node:crypto";

import { ApprovalStatus, EventCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { APPROVERS, approverByKey } from "@/config/approvers";
import { prisma } from "@/lib/db";
import { EmailSendError, sendApprovalEmail } from "@/lib/email";
import { listDepartments } from "@/lib/hibob";

const MANAGER_ID = "manager";

const FormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    description: z.string().trim().max(5000).optional().default(""),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    location: z.string().trim().max(200).optional().default(""),
    teams: z
      .array(z.string().min(1))
      .min(1, "Pick at least one team."),
    approverKey: z.enum(APPROVERS.map((a) => a.key) as [string, ...string[]]),
    notifyKey: z
      .enum(["", ...APPROVERS.map((a) => a.key)] as [string, ...string[]])
      .optional()
      .default(""),
    category: z
      .enum(Object.values(EventCategory) as [string, ...string[]])
      .optional()
      .default(EventCategory.CONFERENCE),
    budgetEuros: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.coerce.number().nonnegative().max(10_000_000).optional(),
      )
      .default(0),
  })
  .refine(
    (v) => {
      const s = Date.parse(v.startDate);
      const e = Date.parse(v.endDate);
      return Number.isFinite(s) && Number.isFinite(e) && s <= e;
    },
    { message: "Start date must be on or before end date.", path: ["endDate"] },
  );

export type CreateEventState =
  | { ok: false; message?: string; fieldErrors?: Record<string, string[]> }
  | { ok: true };

export async function createEventAction(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const raw = {
    title: (formData.get("title") ?? "").toString(),
    description: (formData.get("description") ?? "").toString(),
    startDate: (formData.get("startDate") ?? "").toString(),
    endDate: (formData.get("endDate") ?? "").toString(),
    location: (formData.get("location") ?? "").toString(),
    teams: formData.getAll("teams").map((v) => v.toString()).filter(Boolean),
    approverKey: (formData.get("approverKey") ?? "").toString(),
    notifyKey: (formData.get("notifyKey") ?? "").toString(),
    category: (formData.get("category") ?? "").toString() || undefined,
    budgetEuros: (formData.get("budgetEuros") ?? "").toString(),
  };

  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const approver = approverByKey(parsed.data.approverKey);
  if (!approver) {
    return { ok: false, fieldErrors: { approverKey: ["Unknown approver."] } };
  }
  const notifyKey = parsed.data.notifyKey && parsed.data.notifyKey.length > 0
    ? parsed.data.notifyKey
    : null;
  if (notifyKey && !approverByKey(notifyKey)) {
    return { ok: false, fieldErrors: { notifyKey: ["Unknown recipient."] } };
  }

  // Resolve selected team names to hibobDepartmentId for stable storage.
  let departments;
  try {
    departments = await listDepartments();
  } catch (err) {
    console.error("[events/new] listDepartments failed", err);
    return {
      ok: false,
      message: "Couldn't load departments from HiBob. Try again shortly.",
    };
  }

  const byName = new Map(departments.map((d) => [d.name, d]));
  const teamRows: { hibobDepartmentId: string; displayName: string }[] = [];
  for (const name of parsed.data.teams) {
    const d = byName.get(name);
    if (!d) {
      return {
        ok: false,
        fieldErrors: { teams: [`Unknown team: ${name}`] },
      };
    }
    teamRows.push({ hibobDepartmentId: d.id, displayName: d.name });
  }

  const approvalToken = randomBytes(32).toString("base64url");

  let eventId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description ?? "",
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          location: parsed.data.location ?? "",
          approvalStatus: ApprovalStatus.DRAFT,
          approvalToken,
          category: parsed.data.category as EventCategory,
          budgetCents: Math.round((parsed.data.budgetEuros ?? 0) * 100),
          approver: { connect: { id: approver.key } },
          notifyUser: notifyKey ? { connect: { id: notifyKey } } : undefined,
          createdBy: { connect: { id: MANAGER_ID } },
          teams: { create: teamRows },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          eventId: event.id,
          actor: "manager",
          action: "event.created",
          payloadJson: {
            title: parsed.data.title,
            approverKey: approver.key,
            teamNames: teamRows.map((t) => t.displayName),
          },
        },
      });
      return event;
    });
    eventId = result.id;
  } catch (err) {
    console.error("[events/new] transaction failed", err);
    return { ok: false, message: "Couldn't save the event. Try again." };
  }

  try {
    const sent = await sendApprovalEmail({
      eventId,
      eventTitle: parsed.data.title,
      approverDisplayName: approver.displayName,
      approverEmail: approver.email,
      approvalToken,
      teamNames: teamRows.map((t) => t.displayName),
    });
    await prisma.event.update({
      where: { id: eventId },
      data: { approvalStatus: ApprovalStatus.SENT },
    });
    await prisma.auditLog.create({
      data: {
        eventId,
        actor: "system",
        action: "approval.email_sent",
        payloadJson: {
          to: sent.to,
          subject: sent.subject,
          mode: sent.mode,
        },
      },
    });
  } catch (err) {
    if (err instanceof EmailSendError) {
      console.error("[events/new] email send failed — leaving event DRAFT", {
        eventId,
        status: err.status,
      });
    } else {
      console.error("[events/new] unexpected email error", err);
    }
    // Event row is saved; user can resend from detail page (step 8).
  }

  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}
