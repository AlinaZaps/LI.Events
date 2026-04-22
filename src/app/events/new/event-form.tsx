"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import { type CreateEventState, createEventAction } from "./actions";

type Department = { id: string; name: string };
type Approver = { key: string; displayName: string; email: string };

const CATEGORIES = [
  { value: "CONFERENCE", label: "Conference" },
  { value: "SIDE_EVENT", label: "Side event" },
  { value: "HACKATHON", label: "Hackathon" },
  { value: "BD_DINNER", label: "BD dinner" },
  { value: "SPONSORSHIP", label: "Sponsorship" },
] as const;

const INITIAL_STATE: CreateEventState = { ok: false };

export function EventForm({
  departments,
  approvers,
}: {
  departments: Department[];
  approvers: Approver[];
}) {
  const [state, formAction, pending] = useActionState(createEventAction, INITIAL_STATE);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [approverKey, setApproverKey] = useState<string>(approvers[0]?.key ?? "");
  const [notifyKey, setNotifyKey] = useState<string>("");

  const fieldErrors = "fieldErrors" in state ? state.fieldErrors : undefined;
  const topMessage = "message" in state ? state.message : undefined;

  function toggleTeam(name: string, next: boolean) {
    setSelectedTeams((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(name);
      else copy.delete(name);
      return copy;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {topMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-13 text-red"
        >
          {topMessage}
        </div>
      ) : null}

      <Field label="Title" htmlFor="title" error={fieldErrors?.title?.[0]}>
        <Input id="title" name="title" required autoComplete="off" />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        hint="Plain text; line breaks preserved."
        error={fieldErrors?.description?.[0]}
      >
        <Textarea id="description" name="description" rows={5} />
      </Field>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Start date" htmlFor="startDate" error={fieldErrors?.startDate?.[0]}>
          <Input id="startDate" name="startDate" type="date" required />
        </Field>
        <Field label="End date" htmlFor="endDate" error={fieldErrors?.endDate?.[0]}>
          <Input id="endDate" name="endDate" type="date" required />
        </Field>
      </div>

      <Field label="Location" htmlFor="location" error={fieldErrors?.location?.[0]}>
        <Input id="location" name="location" autoComplete="off" />
      </Field>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Category" htmlFor="category" error={fieldErrors?.category?.[0]}>
          <select
            id="category"
            name="category"
            defaultValue="CONFERENCE"
            className="h-9 rounded-lg border border-border bg-surface px-3 text-13 outline-none focus:border-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Budget (EUR)"
          htmlFor="budgetEuros"
          hint="Total allocated spend — optional."
          error={fieldErrors?.budgetEuros?.[0]}
        >
          <Input
            id="budgetEuros"
            name="budgetEuros"
            type="number"
            min={0}
            step={100}
            placeholder="0"
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="Teams"
        hint="Sourced from HiBob departments. Pick one or more."
        error={fieldErrors?.teams?.[0]}
      >
        {departments.length === 0 ? (
          <p className="text-13 text-muted">No departments loaded.</p>
        ) : (
          <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-2 md:grid-cols-2">
            {departments.map((d) => {
              const checked = selectedTeams.has(d.name);
              const id = `team-${d.id}`;
              return (
                <label
                  key={d.id}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-13 hover:bg-surface-2"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(v) => toggleTeam(d.name, v === true)}
                  />
                  {checked ? (
                    <input type="hidden" name="teams" value={d.name} />
                  ) : null}
                  <span>{d.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Approver" error={fieldErrors?.approverKey?.[0]}>
        <RadioGroup
          name="approverKey"
          value={approverKey}
          onValueChange={setApproverKey}
          className="grid grid-cols-1 gap-2 md:grid-cols-3"
        >
          {approvers.map((a) => {
            const id = `approver-${a.key}`;
            const selected = approverKey === a.key;
            return (
              <label
                key={a.key}
                htmlFor={id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                  selected
                    ? "border-accent bg-accent-dim"
                    : "border-border bg-surface hover:bg-surface-2"
                }`}
              >
                <RadioGroupItem id={id} value={a.key} className="mt-0.5" />
                <span className="flex flex-col">
                  <span className="text-13 font-medium">{a.displayName}</span>
                  <span className="text-12 text-muted">{a.email}</span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </Field>

      <Field
        label="Notify on submission"
        hint="Optional — gets an email when the approver submits."
        error={fieldErrors?.notifyKey?.[0]}
      >
        <input type="hidden" name="notifyKey" value={notifyKey} />
        <RadioGroup
          value={notifyKey}
          onValueChange={setNotifyKey}
          className="grid grid-cols-1 gap-2 md:grid-cols-4"
        >
          {[{ key: "", displayName: "No one", email: "Skip the notification" }, ...approvers].map((a) => {
            const id = `notify-${a.key || "none"}`;
            const selected = notifyKey === a.key;
            return (
              <label
                key={a.key || "none"}
                htmlFor={id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                  selected
                    ? "border-accent bg-accent-dim"
                    : "border-border bg-surface hover:bg-surface-2"
                }`}
              >
                <RadioGroupItem id={id} value={a.key} className="mt-0.5" />
                <span className="flex flex-col">
                  <span className="text-13 font-medium">{a.displayName}</span>
                  <span className="text-12 text-muted">{a.email}</span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor} className="text-13 font-medium">
          {label}
        </Label>
        {hint ? <span className="text-11 text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-12 text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
