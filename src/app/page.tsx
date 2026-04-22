import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-2 text-muted",
  SENT: "bg-accent-dim text-accent",
  COMPLETED: "bg-green-dim text-green",
};

export default async function HomePage() {
  const [totalEvents, completedEvents, pendingEvents, recent, archived] =
    await Promise.all([
      prisma.event.count({ where: { archivedAt: null } }),
      prisma.event.count({
        where: { archivedAt: null, approvalStatus: "COMPLETED" },
      }),
      prisma.event.count({
        where: { archivedAt: null, approvalStatus: { in: ["DRAFT", "SENT"] } },
      }),
      prisma.event.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          approver: true,
          _count: { select: { attendees: true } },
        },
      }),
      prisma.event.findMany({
        where: { archivedAt: { not: null } },
        orderBy: { archivedAt: "desc" },
        take: 5,
        include: {
          approver: true,
          _count: { select: { attendees: true } },
        },
      }),
    ]);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt="LI.Events"
              width={28}
              height={28}
              className="size-7 rounded-lg"
              priority
            />
            <span className="t-h4">LI.Events</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
        <section className="flex flex-col gap-3">
          <span className="t-eyebrow">LI.FI · workspace manager</span>
          <h1 className="t-h1">Every conference. One command center.</h1>
          <p className="t-body text-muted max-w-2xl">
            Events, budgets, attendees, and BD pipeline in one place. Moss tracks
            the spend, HiBob tracks the people, approvers sign off in one click
            — and you see the whole thing on a single page instead of six.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link href="/events/new" className={buttonVariants()}>
              New event
            </Link>
            <Link
              href="/events"
              className={buttonVariants({ variant: "outline" })}
            >
              View all events
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Total events" value={totalEvents} />
          <Stat label="Awaiting approval" value={pendingEvents} />
          <Stat label="Approved" value={completedEvents} />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="t-h3">Recent events</h2>
            {recent.length > 0 ? (
              <Link href="/events" className="text-12 text-accent hover:underline">
                See all →
              </Link>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
              <p className="t-h4 mb-2">No events yet.</p>
              <p className="t-body text-muted mb-4">
                Create your first event and send it off for approval.
              </p>
              <Link href="/events/new" className={buttonVariants()}>
                Create event
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              <table className="w-full text-13">
                <thead className="bg-surface-2 text-left text-12 text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Dates</th>
                    <th className="px-4 py-2.5 font-medium">Approver</th>
                    <th className="px-4 py-2.5 font-medium">Approval status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Approved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${e.id}`}
                          className="font-medium hover:underline"
                        >
                          {e.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {fmt(e.startDate)} → {fmt(e.endDate)}
                      </td>
                      <td className="px-4 py-3">{e.approver.displayName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-pill px-2 py-0.5 text-11 ${
                            STATUS_STYLES[e.approvalStatus] ?? "bg-surface-2 text-muted"
                          }`}
                        >
                          {e.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {e._count.attendees}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {archived.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="t-h3">Archived events</h2>
              <Link
                href="/events/archived"
                className="text-12 text-accent hover:underline"
              >
                See all →
              </Link>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              <table className="w-full text-13">
                <thead className="bg-surface-2 text-left text-12 text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Dates</th>
                    <th className="px-4 py-2.5 font-medium">Approver</th>
                    <th className="px-4 py-2.5 font-medium">Archived</th>
                    <th className="px-4 py-2.5 font-medium text-right">Approved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {archived.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/events/${e.id}`}
                          className="font-medium hover:underline"
                        >
                          {e.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {fmt(e.startDate)} → {fmt(e.endDate)}
                      </td>
                      <td className="px-4 py-3">{e.approver.displayName}</td>
                      <td className="px-4 py-3 text-muted">
                        {e.archivedAt ? fmt(e.archivedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {e._count.attendees}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="t-eyebrow">{label}</div>
      <div className="mt-1 text-28 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
