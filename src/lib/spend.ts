import "server-only";

import mossSpend from "./mock/moss-spend.json";

export type SpendLineItem = {
  event: string;
  label: string;
  category: string;
  amount: number;
  description: string;
};

const EVENT_ALIAS: Record<string, string> = {
  "CFC St. Moritz 2026": "Davos (CFC St. Moritz 2026)",
};

export function lineItemsForEventTitle(title: string): SpendLineItem[] {
  const aliased = EVENT_ALIAS[title] ?? title;
  const items = mossSpend.lineItems as SpendLineItem[];
  return items.filter(
    (it) => it.event === title || it.event === aliased,
  );
}

export const CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel",
  tickets: "Tickets",
  events: "Events",
  sponsorships: "Sponsorships",
  other: "Other",
};

export const CATEGORY_TONES: Record<string, string> = {
  travel: "bg-accent-dim text-accent",
  tickets: "bg-pink-dim text-pink",
  events: "bg-amber-dim text-amber",
  sponsorships: "bg-green-dim text-green",
  other: "bg-surface-2 text-muted",
};
