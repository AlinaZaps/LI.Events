"use server";

import { ApprovalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { EmailSendError, sendApprovalEmail } from "@/lib/email";

export type ResendApprovalState =
  | { ok: false; message?: string }
  | { ok: true; to: string };

export async function resendApprovalAction(
  _prev: ResendApprovalState,
  formData: FormData,
): Promise<ResendApprovalState> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string" || !eventId) {
    return { ok: false, message: "Invalid event." };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { approver: true, teams: true },
  });
  if (!event) {
    return { ok: false, message: "Event not found." };
  }

  let sendResult;
  try {
    sendResult = await sendApprovalEmail({
      eventId: event.id,
      eventTitle: event.title,
      approverDisplayName: event.approver.displayName,
      approverEmail: event.approver.email,
      approvalToken: event.approvalToken,
      teamNames: event.teams.map((t) => t.displayName),
    });
  } catch (err) {
    if (err instanceof EmailSendError) {
      console.error("[events/resend] email send failed", {
        eventId: event.id,
        status: err.status,
      });
      return { ok: false, message: "Couldn't send the email. Try again shortly." };
    }
    console.error("[events/resend] unexpected email error", {
      eventId: event.id,
      err,
    });
    return { ok: false, message: "Couldn't send the email. Try again shortly." };
  }

  if (event.approvalStatus === ApprovalStatus.DRAFT) {
    await prisma.event.update({
      where: { id: event.id },
      data: { approvalStatus: ApprovalStatus.SENT },
    });
  }

  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      actor: "manager",
      action: "approval.email_resent",
      payloadJson: {
        to: sendResult.to,
        subject: sendResult.subject,
        mode: sendResult.mode,
      },
    },
  });

  revalidatePath(`/events/${event.id}`);
  revalidatePath("/events");
  return { ok: true, to: event.approver.email };
}

export async function archiveEventAction(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId");
  const action = formData.get("op");
  if (typeof eventId !== "string" || !eventId) return;
  const archiving = action !== "unarchive";
  await prisma.event.update({
    where: { id: eventId },
    data: { archivedAt: archiving ? new Date() : null },
  });
  await prisma.auditLog.create({
    data: {
      eventId,
      actor: "manager",
      action: archiving ? "event.archived" : "event.unarchived",
    },
  });
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string" || !eventId) return;
  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/events");
}
