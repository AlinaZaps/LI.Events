import { randomBytes } from "node:crypto";

import {
  ApprovalStatus,
  EventCategory,
  EventStatus,
  PrismaClient,
  Role,
} from "@prisma/client";

import { APPROVERS } from "../src/config/approvers";
import mossSpend from "../src/lib/mock/moss-spend.json";

const prisma = new PrismaClient();

type MossEvent = {
  id: string;
  name: string;
  travel: number;
  tickets: number;
  eventsCost: number;
  sponsorships: number;
  total: number;
  attendees: number;
  costPerPerson: number;
};

const EVENT_DATES: Record<string, { start: string; end: string; location: string }> = {
  "ethdenver-2026": { start: "2026-02-23", end: "2026-03-02", location: "Denver, CO" },
  "ethcc-cannes-2026": { start: "2026-06-30", end: "2026-07-03", location: "Cannes, France" },
  "das-nyc-2026": { start: "2026-03-18", end: "2026-03-20", location: "New York, NY" },
  "consensus-hong-kong-2026": {
    start: "2026-02-10",
    end: "2026-02-12",
    location: "Hong Kong",
  },
  "cfc-st-moritz-2026": { start: "2026-01-15", end: "2026-01-18", location: "St. Moritz" },
};

async function main() {
  const manager = await prisma.user.upsert({
    where: { id: "manager" },
    update: {
      email: "manager@local",
      displayName: "Workspace Manager",
      role: Role.MANAGER,
    },
    create: {
      id: "manager",
      email: "manager@local",
      displayName: "Workspace Manager",
      role: Role.MANAGER,
    },
  });

  const approvers = await Promise.all(
    APPROVERS.map((a) =>
      prisma.user.upsert({
        where: { id: a.key },
        update: {
          email: a.email,
          displayName: a.displayName,
          role: Role.APPROVER,
        },
        create: {
          id: a.key,
          email: a.email,
          displayName: a.displayName,
          role: Role.APPROVER,
        },
      }),
    ),
  );

  // --- Moss-sourced events (Step 1) ---------------------------------------
  const defaultApproverKey = APPROVERS[0]?.key ?? "alina";
  const events = mossSpend.events as MossEvent[];

  const seededEvents = [];
  for (const ev of events) {
    const dateRange = EVENT_DATES[ev.id] ?? {
      start: "2026-01-01",
      end: "2026-01-02",
      location: "",
    };
    const spentCents = Math.round(ev.total * 100);
    // ~10% headroom over actual, rounded to nearest €1,000
    const rawBudget = ev.total * 1.1;
    const roundedEuros = Math.round(rawBudget / 1000) * 1000;
    let budgetCents = roundedEuros * 100;
    // Demo override: EthCC overruns its budget.
    if (ev.id === "ethcc-cannes-2026") {
      budgetCents = 100_000 * 100;
    }

    const existing = await prisma.event.findFirst({ where: { title: ev.name } });
    if (existing) {
      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          category: EventCategory.CONFERENCE,
          lifecycleStatus: EventStatus.PAST,
          budgetCents,
          spentCents,
          location: existing.location || dateRange.location,
          startDate: new Date(dateRange.start),
          endDate: new Date(dateRange.end),
        },
      });
      seededEvents.push(updated);
      continue;
    }

    const created = await prisma.event.create({
      data: {
        title: ev.name,
        description: `Q1 2026 conference — ${ev.attendees} LI.FI attendees, €${ev.total.toLocaleString()} total spend.`,
        startDate: new Date(dateRange.start),
        endDate: new Date(dateRange.end),
        location: dateRange.location,
        approvalStatus: ApprovalStatus.COMPLETED,
        approvalToken: randomBytes(32).toString("base64url"),
        category: EventCategory.CONFERENCE,
        lifecycleStatus: EventStatus.PAST,
        budgetCents,
        spentCents,
        approver: { connect: { id: defaultApproverKey } },
        createdBy: { connect: { id: manager.id } },
      },
    });
    seededEvents.push(created);
  }

  console.log("Seed complete:", {
    manager: manager.id,
    approvers: approvers.map((a) => a.id),
    mossEvents: seededEvents.map((e) => ({
      id: e.id,
      title: e.title,
      budget: e.budgetCents / 100,
      spent: e.spentCents / 100,
    })),
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
