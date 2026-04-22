import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";
import {
  HibobApiError,
  HibobConfigError,
  listEmployeesByDepartments,
} from "@/lib/hibob";

import { ApprovalForm, type AttendeeRow } from "./approval-form";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await prisma.event.findUnique({
    where: { approvalToken: token },
    include: {
      teams: true,
      approver: true,
      attendees: true,
    },
  });
  if (!event) notFound();

  const teamNames = event.teams.map((t) => t.displayName);

  let rosterError: string | null = null;
  let liveEmployees: Awaited<ReturnType<typeof listEmployeesByDepartments>> = [];
  try {
    liveEmployees = await listEmployeesByDepartments(teamNames);
  } catch (err) {
    if (err instanceof HibobConfigError || err instanceof HibobApiError) {
      console.error("[approve] roster fetch failed", {
        eventId: event.id,
        err,
      });
    } else {
      console.error("[approve] roster fetch unexpected error", {
        eventId: event.id,
        err,
      });
    }
    rosterError = "Couldn't load team roster — try again shortly.";
  }

  // Dedupe live employees by hibobEmployeeId; first wins.
  const byId = new Map<string, AttendeeRow>();
  for (const emp of liveEmployees) {
    if (!byId.has(emp.id)) {
      byId.set(emp.id, {
        hibobEmployeeId: emp.id,
        displayName: emp.displayName,
        email: emp.email,
        department: emp.department,
        stale: false,
        initiallyApproved: false,
      });
    }
  }

  // Mark existing approved attendees as initially checked; include stale ones.
  for (const a of event.attendees) {
    const existing = byId.get(a.hibobEmployeeId);
    if (existing) {
      existing.initiallyApproved = true;
    } else {
      byId.set(a.hibobEmployeeId, {
        hibobEmployeeId: a.hibobEmployeeId,
        displayName: a.displayName,
        email: a.email,
        department: a.department || "",
        stale: true,
        initiallyApproved: true,
      });
    }
  }

  const rows = Array.from(byId.values()).sort((a, b) => {
    if (a.stale !== b.stale) return a.stale ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="t-h4">
            LI.Events
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-1">
          <span className="t-eyebrow">Approval needed</span>
          <h1 className="t-h1">{event.title}</h1>
          <p className="t-body text-muted">
            Hi {event.approver.displayName} — pick who should travel. Submit when
            you&apos;re ready; you can come back and edit this anytime.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
          <dl className="grid grid-cols-1 gap-4 text-13 md:grid-cols-2">
            <Row label="Dates" value={`${fmt(event.startDate)} → ${fmt(event.endDate)}`} />
            <Row label="Location" value={event.location || "—"} />
            <Row label="Teams" value={teamNames.join(", ") || "—"} />
          </dl>
          {event.description ? (
            <div className="mt-5">
              <div className="t-eyebrow mb-1.5">Description</div>
              <p className="whitespace-pre-wrap text-13">{event.description}</p>
            </div>
          ) : null}
        </div>

        {rosterError ? (
          <div
            role="alert"
            className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-13 text-red"
          >
            {rosterError}
          </div>
        ) : (
          <ApprovalForm token={token} rows={rows} teamNames={teamNames} />
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="t-eyebrow">{label}</span>
      <span>{value}</span>
    </div>
  );
}
