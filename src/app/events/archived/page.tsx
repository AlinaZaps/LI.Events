import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-2 text-muted",
  SENT: "bg-accent-dim text-accent",
  COMPLETED: "bg-green-dim text-green",
};

export default async function ArchivedEventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { archivedAt: "desc" },
    where: { archivedAt: { not: null } },
    include: {
      approver: true,
      _count: { select: { attendees: true } },
    },
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="t-h4">
            LI.Events
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-1">
          <Link href="/events" className="t-eyebrow hover:underline">
            ← All events
          </Link>
          <h1 className="t-h1">Archived events</h1>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
            <p className="t-h4 mb-2">No archived events.</p>
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
                  <th className="px-4 py-2.5 font-medium">Archived</th>
                  <th className="px-4 py-2.5 font-medium text-right">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/events/${e.id}`} className="font-medium hover:underline">
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
        )}
      </main>
    </div>
  );
}
