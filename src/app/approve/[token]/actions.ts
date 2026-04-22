"use server";

import { ApprovalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { EmailSendError, sendSubmissionNotifyEmail } from "@/lib/email";

const SubmitSchema = z.object({
  token: z.string().min(1),
  attendees: z
    .array(
      z.object({
        hibobEmployeeId: z.string().min(1),
        displayName: z.string().default(""),
        email: z.string().default(""),
        department: z.string().default(""),
      }),
    )
    .max(2000),
});

export type SubmitApprovalState =
  | { ok: false; message?: string }
  | { ok: true; approvedCount: number };

export async function submitApprovalAction(
  _prev: SubmitApprovalState,
  formData: FormData,
): Promise<SubmitApprovalState> {
  const payload = formData.get("payload");
  if (typeof payload !== "string") {
    return { ok: false, message: "Invalid submission." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payload);
  } catch {
    return { ok: false, message: "Invalid submission." };
  }

  const parsed = SubmitSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, message: "Invalid submission." };
  }

  const event = await prisma.event.findUnique({
    where: { approvalToken: parsed.data.token },
    include: { approver: true, notifyUser: true },
  });
  if (!event) {
    return { ok: false, message: "This approval link is no longer valid." };
  }

  // Dedupe by hibobEmployeeId (last-wins for fields).
  const byId = new Map<string, (typeof parsed.data.attendees)[number]>();
  for (const a of parsed.data.attendees) {
    byId.set(a.hibobEmployeeId, a);
  }
  const rows = Array.from(byId.values());

  const alreadyCompleted = event.approvalStatus === ApprovalStatus.COMPLETED;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvedAttendee.deleteMany({ where: { eventId: event.id } });
      if (rows.length > 0) {
        await tx.approvedAttendee.createMany({
          data: rows.map((r) => ({
            eventId: event.id,
            hibobEmployeeId: r.hibobEmployeeId,
            displayName: r.displayName,
            email: r.email,
            department: r.department,
          })),
        });
      }
      await tx.event.update({
        where: { id: event.id },
        data: { approvalStatus: ApprovalStatus.COMPLETED },
      });
      await tx.auditLog.create({
        data: {
          eventId: event.id,
          actor: `approver:${event.approver.id}`,
          action: alreadyCompleted ? "approval.updated" : "approval.submitted",
          payloadJson: { approvedCount: rows.length },
        },
      });
    });
  } catch (err) {
    console.error("[approve] submit transaction failed", {
      eventId: event.id,
      err,
    });
    return { ok: false, message: "Couldn't save. Try again." };
  }

  if (event.notifyUser) {
    try {
      const sent = await sendSubmissionNotifyEmail({
        eventId: event.id,
        eventTitle: event.title,
        recipientDisplayName: event.notifyUser.displayName,
        recipientEmail: event.notifyUser.email,
        approverDisplayName: event.approver.displayName,
        approvedCount: rows.length,
        isUpdate: alreadyCompleted,
      });
      await prisma.auditLog.create({
        data: {
          eventId: event.id,
          actor: "system",
          action: "submission.notified",
          payloadJson: {
            to: sent.to,
            subject: sent.subject,
            mode: sent.mode,
          },
        },
      });
    } catch (err) {
      if (err instanceof EmailSendError) {
        console.error("[approve] notify email failed", {
          eventId: event.id,
          status: err.status,
        });
      } else {
        console.error("[approve] notify email unexpected error", {
          eventId: event.id,
          err,
        });
      }
    }
  }

  revalidatePath(`/approve/${parsed.data.token}`);
  revalidatePath(`/events/${event.id}`);
  return { ok: true, approvedCount: rows.length };
}
