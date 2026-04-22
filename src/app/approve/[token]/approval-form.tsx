"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { type SubmitApprovalState, submitApprovalAction } from "./actions";

export type AttendeeRow = {
  hibobEmployeeId: string;
  displayName: string;
  email: string;
  department: string;
  stale: boolean;
  initiallyApproved: boolean;
};

type Props = {
  token: string;
  rows: AttendeeRow[];
  teamNames: string[];
};

const INITIAL_STATE: SubmitApprovalState = { ok: false };

export function ApprovalForm({ token, rows, teamNames }: Props) {
  const [state, formAction, pending] = useActionState(submitApprovalAction, INITIAL_STATE);

  const initialChecked = useMemo(
    () =>
      new Set(
        rows.filter((r) => r.initiallyApproved).map((r) => r.hibobEmployeeId),
      ),
    [rows],
  );
  const [checked, setChecked] = useState<Set<string>>(initialChecked);
  const [query, setQuery] = useState("");
  const hasRealDepartments = rows.some((r) => r.department && r.department !== "N/A");
  const [activeTeams, setActiveTeams] = useState<Set<string>>(new Set());
  const isFiltered = query.trim().length > 0 || activeTeams.size > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeTeams.size > 0 && !activeTeams.has(r.department)) return false;
      if (!q) return true;
      return (
        r.displayName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [rows, query, activeTeams]);

  function toggle(id: string, next: boolean) {
    setChecked((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function toggleTeam(name: string) {
    setActiveTeams((prev) => {
      const copy = new Set(prev);
      if (copy.has(name)) copy.delete(name);
      else copy.add(name);
      return copy;
    });
  }

  function selectAllVisible() {
    setChecked((prev) => {
      const copy = new Set(prev);
      for (const r of visible) copy.add(r.hibobEmployeeId);
      return copy;
    });
  }

  function clearAllVisible() {
    setChecked((prev) => {
      const copy = new Set(prev);
      for (const r of visible) copy.delete(r.hibobEmployeeId);
      return copy;
    });
  }

  function selectAll() {
    setChecked(new Set(rows.map((r) => r.hibobEmployeeId)));
  }

  function clearAll() {
    setChecked(new Set());
  }

  function selectGroup(ids: string[]) {
    setChecked((prev) => {
      const copy = new Set(prev);
      for (const id of ids) copy.add(id);
      return copy;
    });
  }

  function clearGroup(ids: string[]) {
    setChecked((prev) => {
      const copy = new Set(prev);
      for (const id of ids) copy.delete(id);
      return copy;
    });
  }

  const groups = useMemo(() => {
    if (!hasRealDepartments) {
      return [{ name: "All", rows: visible, stale: false }];
    }
    const teamOrder = new Map<string, number>();
    teamNames.forEach((name, i) => teamOrder.set(name, i));
    const byTeam = new Map<string, AttendeeRow[]>();
    const staleRows: AttendeeRow[] = [];
    for (const r of visible) {
      if (r.stale) {
        staleRows.push(r);
        continue;
      }
      const key = r.department || "Unassigned";
      const list = byTeam.get(key);
      if (list) list.push(r);
      else byTeam.set(key, [r]);
    }
    const teamGroups = Array.from(byTeam.entries())
      .sort(([a], [b]) => {
        const ai = teamOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bi = teamOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
      })
      .map(([name, groupRows]) => ({ name, rows: groupRows, stale: false }));
    if (staleRows.length > 0) {
      teamGroups.push({ name: "No longer on team", rows: staleRows, stale: true });
    }
    return teamGroups;
  }, [visible, teamNames, hasRealDepartments]);

  const payload = useMemo(() => {
    const attendees = rows
      .filter((r) => checked.has(r.hibobEmployeeId))
      .map((r) => ({
        hibobEmployeeId: r.hibobEmployeeId,
        displayName: r.displayName,
        email: r.email,
        department: r.department,
      }));
    return JSON.stringify({ token, attendees });
  }, [rows, checked, token]);

  const approvedCount = "ok" in state && state.ok ? state.approvedCount : null;
  const errorMessage = "ok" in state && !state.ok ? state.message : undefined;

  if (approvedCount !== null) {
    return (
      <div className="rounded-xl border border-green/30 bg-green-dim p-6 shadow-card">
        <div className="t-eyebrow mb-2">Done</div>
        <h2 className="t-h3 mb-1">Approval submitted.</h2>
        <p className="t-body text-muted">
          {approvedCount} {approvedCount === 1 ? "person" : "people"} approved.
          You can come back and edit this anytime — bookmark this link or ask
          the workspace manager to resend it.
        </p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Edit selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="payload" value={payload} />

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-13 text-red"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          type="search"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="md:max-w-sm"
        />
        <div className="flex items-center gap-2 text-12 text-muted">
          <span>
            {checked.size} selected · {visible.length} shown · {rows.length} total
          </span>
        </div>
      </div>

      {hasRealDepartments && teamNames.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {teamNames.map((t) => {
            const active = activeTeams.has(t);
            return (
              <button
                type="button"
                key={t}
                onClick={() => toggleTeam(t)}
                className={`rounded-pill border px-3 py-1 text-12 transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-text hover:bg-surface-2"
                }`}
              >
                {t}
              </button>
            );
          })}
          {activeTeams.size > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTeams(new Set())}
              className="rounded-pill border border-border px-3 py-1 text-12 text-muted hover:bg-surface-2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={selectAllVisible}>
          Select all visible
        </Button>
        <Button type="button" variant="ghost" onClick={clearAllVisible}>
          Clear visible
        </Button>
        {isFiltered ? (
          <>
            <span aria-hidden className="text-muted">·</span>
            <Button type="button" variant="ghost" onClick={selectAll}>
              Select all ({rows.length})
            </Button>
            <Button type="button" variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
          </>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface px-4 py-8 text-center text-13 text-muted shadow-card">
          {rows.length === 0
            ? "No employees found for the attached teams."
            : "No one matches your search."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const groupIds = group.rows.map((r) => r.hibobEmployeeId);
            const selectedInGroup = groupIds.filter((id) => checked.has(id)).length;
            return (
              <section
                key={group.name}
                className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="t-eyebrow">{group.name}</span>
                    <span className="text-11 text-muted">
                      {selectedInGroup}/{group.rows.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => selectGroup(groupIds)}
                    >
                      Select
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => clearGroup(groupIds)}
                    >
                      Clear
                    </Button>
                  </div>
                </header>
                <ul className="divide-y divide-border">
                  {group.rows.map((r) => {
                    const isChecked = checked.has(r.hibobEmployeeId);
                    const id = `emp-${r.hibobEmployeeId}`;
                    return (
                      <li
                        key={r.hibobEmployeeId}
                        className={`flex items-center gap-3 px-4 py-2.5 text-13 ${
                          r.stale ? "bg-surface-2/60" : ""
                        }`}
                      >
                        <Checkbox
                          id={id}
                          checked={isChecked}
                          onCheckedChange={(v) => toggle(r.hibobEmployeeId, v === true)}
                        />
                        <label
                          htmlFor={id}
                          className="flex flex-1 cursor-pointer items-center gap-3"
                        >
                          <span className="flex flex-col">
                            <span className={r.stale ? "text-muted" : ""}>
                              {r.displayName}
                            </span>
                            {r.email ? (
                              <span className="text-11 text-muted">{r.email}</span>
                            ) : null}
                          </span>
                          {r.stale ? (
                            <span className="ml-auto rounded-pill bg-amber-dim px-2 py-0.5 text-11 text-amber">
                              no longer on team
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit approval"}
        </Button>
      </div>
    </form>
  );
}
