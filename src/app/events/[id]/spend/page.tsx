import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";
import {
  CATEGORY_LABELS,
  CATEGORY_TONES,
  lineItemsForEventTitle,
} from "@/lib/spend";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EUR_DETAIL = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export default async function EventSpendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const items = lineItemsForEventTitle(event.title);
  const byCategory = new Map<string, { total: number; count: number }>();
  let total = 0;
  for (const it of items) {
    total += it.amount;
    const cur = byCategory.get(it.category) ?? { total: 0, count: 0 };
    cur.total += it.amount;
    cur.count += 1;
    byCategory.set(it.category, cur);
  }
  const categoryBreakdown = [...byCategory.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  );

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
        <div className="flex flex-col gap-1">
          <Link href={`/events/${event.id}`} className="t-eyebrow hover:underline">
            ← {event.title}
          </Link>
          <h1 className="t-h1">Spend operations</h1>
          <p className="text-13 text-muted">
            Every transaction pulled from Moss for this event. Names are
            anonymized to `traveler_N`.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="t-eyebrow">Total spent</div>
              <div className="mt-1 text-28 font-semibold tabular-nums">
                {EUR.format(total)}
              </div>
            </div>
            <div className="text-right">
              <div className="t-eyebrow">Operations</div>
              <div className="mt-1 text-28 font-semibold tabular-nums">
                {items.length}
              </div>
            </div>
          </div>
          {categoryBreakdown.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
              {categoryBreakdown.map(([cat, v]) => (
                <div
                  key={cat}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2"
                >
                  <span
                    className={`inline-block rounded-pill px-2 py-0.5 text-10 font-medium uppercase tracking-wider ${
                      CATEGORY_TONES[cat] ?? CATEGORY_TONES.other
                    }`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div className="mt-1.5 text-15 font-semibold tabular-nums">
                    {EUR.format(v.total)}
                  </div>
                  <div className="text-11 text-muted">{v.count} ops</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="t-h4">Operations</h2>
            <span className="text-12 text-muted">{items.length} line items</span>
          </div>
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center text-13 text-muted">
              No operations recorded for this event yet.
            </div>
          ) : (
            <table className="w-full text-13">
              <thead className="bg-surface-2 text-left text-12 text-muted">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Label</th>
                  <th className="px-6 py-2.5 font-medium">Category</th>
                  <th className="px-6 py-2.5 font-medium">Description</th>
                  <th className="px-6 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it, idx) => (
                  <tr key={`${it.label}-${idx}`}>
                    <td className="px-6 py-2.5 font-mono text-12 text-accent">
                      {it.label}
                    </td>
                    <td className="px-6 py-2.5">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-11 ${
                          CATEGORY_TONES[it.category] ?? CATEGORY_TONES.other
                        }`}
                      >
                        {CATEGORY_LABELS[it.category] ?? it.category}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-muted">
                      {it.description || "—"}
                    </td>
                    <td className="px-6 py-2.5 text-right tabular-nums">
                      {EUR_DETAIL.format(it.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
