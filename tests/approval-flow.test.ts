import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & {
      digest: string;
    };
    err.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

const HIBOB_EMPLOYEES = [
  {
    id: "emp-1",
    displayName: "Ada Lovelace",
    email: "ada@li.finance",
    department: "Engineering",
  },
  {
    id: "emp-2",
    displayName: "Alan Turing",
    email: "alan@li.finance",
    department: "Engineering",
  },
  {
    id: "emp-3",
    displayName: "Grace Hopper",
    email: "grace@li.finance",
    department: "Engineering",
  },
];

vi.mock("@/lib/hibob", () => ({
  HibobConfigError: class HibobConfigError extends Error {},
  HibobApiError: class HibobApiError extends Error {},
  listDepartments: vi.fn(async () => [
    { id: "dept-eng", name: "Engineering" },
  ]),
  listEmployeesByDepartments: vi.fn(async () => HIBOB_EMPLOYEES),
}));

const { prisma } = await import("@/lib/db");
const { createEventAction } = await import("@/app/events/new/actions");
const { submitApprovalAction } = await import("@/app/approve/[token]/actions");

async function resetDb() {
  await prisma.auditLog.deleteMany({});
  await prisma.approvedAttendee.deleteMany({});
  await prisma.eventTeam.deleteMany({});
  await prisma.event.deleteMany({});
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("approval flow", () => {
  it("creates event → approves via token → detail shows approved list + audit log", async () => {
    const fd = new FormData();
    fd.set("title", "Test Summit");
    fd.set("description", "Integration test event.");
    fd.set("startDate", "2026-05-01");
    fd.set("endDate", "2026-05-03");
    fd.set("location", "Berlin");
    fd.append("teams", "Engineering");
    fd.set("approverKey", "alina");

    let redirectedTo: string | null = null;
    try {
      await createEventAction({ ok: false }, fd);
    } catch (err) {
      const digest = (err as { digest?: string }).digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        redirectedTo = digest.split(";")[2] ?? null;
        expect(redirectedTo, `redirect URL in digest: ${digest}`).toMatch(
          /^\/events\//,
        );
      } else {
        throw err;
      }
    }

    expect(redirectedTo).not.toBeNull();
    const eventId = redirectedTo!.replace(/^\/events\//, "");
    const created = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { teams: true, auditLogs: true },
    });
    expect(created.title).toBe("Test Summit");
    expect(created.approvalStatus).toBe("SENT");
    expect(created.teams).toHaveLength(1);
    expect(created.teams[0].displayName).toBe("Engineering");

    const actionsLogged = created.auditLogs.map((l) => l.action).sort();
    expect(actionsLogged).toEqual(["approval.email_sent", "event.created"]);

    const approveFd = new FormData();
    approveFd.set(
      "payload",
      JSON.stringify({
        token: created.approvalToken,
        attendees: [
          {
            hibobEmployeeId: "emp-1",
            displayName: "Ada Lovelace",
            email: "ada@li.finance",
            department: "Engineering",
          },
          {
            hibobEmployeeId: "emp-3",
            displayName: "Grace Hopper",
            email: "grace@li.finance",
            department: "Engineering",
          },
        ],
      }),
    );

    const result = await submitApprovalAction({ ok: false }, approveFd);
    expect(result).toEqual({ ok: true, approvedCount: 2 });

    const afterApproval = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: {
        attendees: { orderBy: { displayName: "asc" } },
        auditLogs: { orderBy: { createdAt: "asc" } },
      },
    });
    expect(afterApproval.approvalStatus).toBe("COMPLETED");
    expect(afterApproval.attendees.map((a) => a.hibobEmployeeId).sort()).toEqual([
      "emp-1",
      "emp-3",
    ]);
    expect(afterApproval.attendees.map((a) => a.displayName)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
    ]);

    const auditActions = afterApproval.auditLogs.map((l) => l.action);
    expect(auditActions).toEqual([
      "event.created",
      "approval.email_sent",
      "approval.submitted",
    ]);
    const submittedEntry = afterApproval.auditLogs.find(
      (l) => l.action === "approval.submitted",
    );
    expect(submittedEntry?.actor).toBe("approver:alina");

    const second = await submitApprovalAction({ ok: false }, approveFd);
    expect(second).toEqual({ ok: true, approvedCount: 2 });
    const logsAfterResubmit = await prisma.auditLog.findMany({
      where: { eventId, action: "approval.updated" },
    });
    expect(logsAfterResubmit).toHaveLength(1);
  });
});
