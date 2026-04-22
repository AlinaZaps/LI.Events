"use client";

import type { AuditLog } from "@prisma/client";
import { useState } from "react";

const ACTION_LABEL: Record<string, string> = {
  "event.created": "Event created",
  "approval.email_sent": "Approval email sent",
  "approval.email_resent": "Approval email resent",
  "approval.submitted": "Approval submitted",
  "approval.updated": "Approval updated",
};

function actorLabel(actor: string) {
  if (actor === "manager") return "Workspace manager";
  if (actor === "system") return "System";
  if (actor.startsWith("approver:")) return `Approver (${actor.slice("approver:".length)})`;
  return actor;
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleString();
}

export function AuditLogSection({ logs }: { logs: AuditLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-surface-2/60"
      >
        <span className="t-h4">Activity log</span>
        <span className="text-12 text-muted">
          {logs.length} {logs.length === 1 ? "entry" : "entries"} · {open ? "hide" : "show"}
        </span>
      </button>
      {open ? (
        logs.length === 0 ? (
          <div className="border-t border-border px-6 py-6 text-center text-13 text-muted">
            No activity yet.
          </div>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {logs.map((log) => (
              <li key={log.id} className="px-6 py-3 text-13">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  <span className="text-11 text-muted">{fmtTime(log.createdAt)}</span>
                </div>
                <div className="text-12 text-muted">{actorLabel(log.actor)}</div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
