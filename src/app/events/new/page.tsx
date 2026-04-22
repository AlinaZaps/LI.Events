import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { APPROVERS } from "@/config/approvers";
import { HibobApiError, HibobConfigError, listDepartments } from "@/lib/hibob";

import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  let departments: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    departments = await listDepartments();
  } catch (err) {
    if (err instanceof HibobConfigError) {
      loadError = "HiBob is not configured on the server.";
    } else if (err instanceof HibobApiError) {
      loadError = `Couldn't load departments from HiBob (status ${err.status}).`;
    } else {
      loadError = "Couldn't load departments.";
    }
    console.error("[events/new] listDepartments failed", err);
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="t-h4">
            LI.Events
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-1">
          <span className="t-eyebrow">New event</span>
          <h1 className="t-h1">Create an event</h1>
          <p className="t-body text-muted">
            Pick the teams to invite and the C-level approver who signs off on the attendee list.
          </p>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-13 text-red"
          >
            {loadError}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <EventForm departments={departments} approvers={[...APPROVERS]} />
        </div>
      </main>
    </div>
  );
}
