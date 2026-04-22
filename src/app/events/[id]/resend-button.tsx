"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { type ResendApprovalState, resendApprovalAction } from "./actions";

const INITIAL_STATE: ResendApprovalState = { ok: false };

export function ResendButton({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(resendApprovalAction, INITIAL_STATE);

  const successTo = "ok" in state && state.ok ? state.to : null;
  const error = "ok" in state && !state.ok ? state.message : null;

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Resend approval email"}
      </Button>
      {successTo ? (
        <span className="text-11 text-green">Sent to {successTo}</span>
      ) : null}
      {error ? <span className="text-11 text-red">{error}</span> : null}
    </form>
  );
}
