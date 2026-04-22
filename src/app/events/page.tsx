import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Tab = "upcoming" | "past" | "archived";
const TABS: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "Upcoming & live" },
  { key: "past", label: "Past" },
  { key: "archived", label: "Archived" },
];

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

function isTab(v: string | undefined): v is Tab {
  return v === "upcoming" || v === "past" || v === "archived";
}

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = isTab(sp.tab) ? sp.tab : "upcoming";

  const whereByTab = {
    upcoming: { archivedAt: null, lifecycleStatus: { in: ["UPCOMING", "LIVE"] as const } },
    past: { archivedAt: null, lifecycleStatus: "PAST" as const },
    archived: { archivedAt: { not: null } },
  }[tab];

  const [events, counts] = await Promise.all([
    prisma.event.findMany({
      where: whereByTab,
      orderBy: tab === "archived" ? { archivedAt: "desc" } : { startDate: "asc" },
      include: {
        approver: true,
        _count: { select: { attendees: true } },
      },
    }),
    Promise.all([
      prisma.event.count({
        where: { archivedAt: null, lifecycleStatus: { in: ["UPCOMING", "LIVE"] } },
      }),
      prisma.event.count({ where: { archivedAt: null, lifecycleStatus: "PAST" } }),
      prisma.event.count({ where: { archivedAt: { not: null } } }),
    ]),
  ]);
  const tabCounts: Record<Tab, number> = {
    upcoming: counts[0],
    past: counts[1],
    archived: counts[2],
  };

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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="t-eyebrow">Events</span>
            <h1 className="t-h1">All events</h1>
          </div>
          <Link href="/events/new" className={buttonVariants()}>
            New event
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/events?tab=${t.key}`}
                className={`relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-13 transition-colors ${
                  active
                    ? "border-accent text-text"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-pill px-1.5 py-0.5 text-11 tabular-nums ${
                    active ? "bg-accent-dim text-accent" : "bg-surface-2 text-muted"
                  }`}
                >
                  {tabCounts[t.key]}
                </span>
              </Link>
            );
          })}
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
            <p className="t-h4 mb-2">Nothing here yet.</p>
            <p className="t-body text-muted mb-4">
              {tab === "archived"
                ? "No archived events."
                : tab === "past"
                  ? "No past events."
                  : "Create an event and send it off for approval."}
            </p>
            {tab !== "archived" ? (
              <Link href="/events/new" className={buttonVariants()}>
                Create event
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <table className="w-full text-13">
              <thead className="bg-surface-2 text-left text-12 text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Dates</th>
                  <th className="px-4 py-2.5 font-medium">Approver</th>
                  <th className="px-4 py-2.5 font-medium">Approval</th>
                  {tab === "archived" ? (
                    <th className="px-4 py-2.5 font-medium">Archived</th>
                  ) : null}
                  <th className="px-4 py-2.5 font-medium text-right">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/events/${e.id}`}
                        className="font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                      {e.location ? (
                        <div className="text-11 text-muted">{e.location}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-11 ${
                          LIFECYCLE_STYLES[e.lifecycleStatus] ?? "bg-surface-2 text-muted"
                        }`}
                      >
                        {e.lifecycleStatus.toLowerCase()}
                      </span>
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
                    {tab === "archived" ? (
                      <td className="px-4 py-3 text-muted">
                        {e.archivedAt ? fmt(e.archivedAt) : "—"}
                      </td>
                    ) : null}
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
