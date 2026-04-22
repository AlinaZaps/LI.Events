import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";

import { AuditLogSection } from "./audit-log";
import { DangerZone } from "./danger-zone";
import { ResendButton } from "./resend-button";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-2 text-muted",
  SENT: "bg-accent-dim text-accent",
  COMPLETED: "bg-green-dim text-green",
};

const LIFECYCLE_STYLES: Record<string, string> = {
  PAST: "bg-surface-2 text-muted",
  UPCOMING: "bg-pink-dim text-pink",
  LIVE: "bg-green-dim text-green",
};

const CATEGORY_LABELS: Record<string, string> = {
  CONFERENCE: "Conference",
  SIDE_EVENT: "Side event",
  HACKATHON: "Hackathon",
  BD_DINNER: "BD dinner",
  SPONSORSHIP: "Sponsorship",
};

const EUR = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      teams: true,
      approver: true,
      notifyUser: true,
      attendees: { orderBy: { displayName: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) notFound();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const approveUrl = `/approve/${event.approvalToken}`;

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

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <Link href="/events" className="t-eyebrow hover:underline">
              ← All events
            </Link>
            <h1 className="t-h1">{event.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-pill px-2 py-0.5 text-11 ${
                  LIFECYCLE_STYLES[event.lifecycleStatus] ?? "bg-surface-2 text-muted"
                }`}
              >
                {event.lifecycleStatus.toLowerCase()}
              </span>
              <span className="rounded-pill bg-accent-dim px-2 py-0.5 text-11 text-accent">
                {CATEGORY_LABELS[event.category] ?? event.category}
              </span>
              <span
                className={`rounded-pill px-2 py-0.5 text-11 ${
                  STATUS_STYLES[event.approvalStatus] ?? "bg-surface-2 text-muted"
                }`}
              >
                {event.approvalStatus}
              </span>
              {event.archivedAt ? (
                <span className="rounded-pill bg-amber-dim px-2 py-0.5 text-11 text-amber">
                  Archived
                </span>
              ) : null}
              <span className="text-12 text-muted">
                {event.attendees.length} approved
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ResendButton eventId={event.id} />
            <DangerZone eventId={event.id} archived={event.archivedAt !== null} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <dl className="grid grid-cols-1 gap-4 text-13 md:grid-cols-2">
            <Row
              label="Approver"
              value={`${event.approver.displayName} (${event.approver.email})`}
            />
            <Row
              label="Notify on submission"
              value={
                event.notifyUser
                  ? `${event.notifyUser.displayName} (${event.notifyUser.email})`
                  : "—"
              }
            />
            <Row label="Dates" value={`${fmt(event.startDate)} → ${fmt(event.endDate)}`} />
            <Row label="Location" value={event.location || "—"} />
            <Row
              label="Teams"
              value={event.teams.map((t) => t.displayName).join(", ") || "—"}
            />
            <div className="flex flex-col gap-0.5 md:col-span-2">
              <span className="t-eyebrow">Approval link</span>
              <Link
                href={approveUrl}
                className="break-all text-accent hover:underline"
              >
                {approveUrl}
              </Link>
            </div>
          </dl>
          {event.description ? (
            <div className="mt-6">
              <div className="t-eyebrow mb-2">Description</div>
              <p className="whitespace-pre-wrap text-13">{event.description}</p>
            </div>
          ) : null}
        </div>

        <BudgetCard
          eventId={event.id}
          budgetCents={event.budgetCents}
          spentCents={event.spentCents}
        />

        <section className="rounded-xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="t-h4">Approved attendees</h2>
            <span className="text-12 text-muted">{event.attendees.length} total</span>
          </div>
          {event.attendees.length === 0 ? (
            <div className="px-6 py-10 text-center text-13 text-muted">
              No one approved yet.{" "}
              {event.approvalStatus !== "COMPLETED"
                ? "Waiting on the approver."
                : "The approver submitted an empty list."}
            </div>
          ) : (
            <table className="w-full text-13">
              <thead className="bg-surface-2 text-left text-12 text-muted">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Name</th>
                  <th className="px-6 py-2.5 font-medium">Email</th>
                  <th className="px-6 py-2.5 font-medium">Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {event.attendees.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-2.5">{a.displayName}</td>
                    <td className="px-6 py-2.5 text-muted">{a.email || "—"}</td>
                    <td className="px-6 py-2.5">
                      {a.department ? (
                        <span className="rounded-pill bg-accent-dim px-2 py-0.5 text-11 text-accent">
                          {a.department}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <AuditLogSection logs={event.auditLogs} />
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

function BudgetCard({
  eventId,
  budgetCents,
  spentCents,
}: {
  eventId: string;
  budgetCents: number;
  spentCents: number;
}) {
  const hasBudget = budgetCents > 0;
  const pct = hasBudget
    ? Math.round((spentCents / budgetCents) * 100)
    : spentCents > 0
      ? 100
      : 0;
  const remainingCents = budgetCents - spentCents;
  const over = hasBudget && spentCents > budgetCents;

  // Color buckets: >100 red, >90 red-ish, >60 amber, else pink/accent gradient.
  let barColor = "bg-accent";
  if (over || pct > 90) barColor = "bg-red";
  else if (pct > 60) barColor = "bg-amber";
  else barColor = "bg-pink";

  const barWidth = hasBudget ? Math.min(100, pct) : 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="t-h4">Budget</h2>
        <span className="text-11 text-muted">
          {hasBudget
            ? over
              ? `${pct}% spent · over budget`
              : `${pct}% spent · live via moss`
            : "no budget set"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BudgetTile label="Allocated" value={EUR.format(budgetCents / 100)} />
        <BudgetTile
          label="Spent"
          value={EUR.format(spentCents / 100)}
          href={`/events/${eventId}/spend`}
        />
        <BudgetTile
          label={over ? "Over by" : "Remaining"}
          value={EUR.format(Math.abs(remainingCents) / 100)}
          tone={over ? "red" : "muted"}
        />
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-pill bg-surface-2">
        <div
          className={`h-full ${barColor} transition-[width] duration-500`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </section>
  );
}

function BudgetTile({
  label,
  value,
  tone = "muted",
  href,
}: {
  label: string;
  value: string;
  tone?: "muted" | "red";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="t-eyebrow">{label}</span>
        {href ? (
          <span className="text-11 text-accent" aria-hidden>
            view →
          </span>
        ) : null}
      </div>
      <div
        className={`mt-1 text-22 font-semibold tabular-nums ${
          tone === "red" ? "text-red" : ""
        }`}
      >
        {value}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-lg border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-accent hover:bg-accent-dim"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      {body}
    </div>
  );
}
