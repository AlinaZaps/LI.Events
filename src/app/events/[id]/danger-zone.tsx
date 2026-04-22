"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { archiveEventAction, deleteEventAction } from "./actions";

type Props = { eventId: string; archived: boolean };

export function DangerZone({ eventId, archived }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={archiveEventAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="op" value={archived ? "unarchive" : "archive"} />
        <Button type="submit" variant="outline">
          {archived ? "Unarchive" : "Archive"}
        </Button>
      </form>

      {confirming ? (
        <form
          action={deleteEventAction}
          className="flex items-center gap-2 rounded-lg border border-red/40 bg-red/5 px-2 py-1"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <span className="text-12 text-red">Delete permanently?</span>
          <Button type="submit" variant="destructive" size="sm">
            Confirm delete
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirming(true)}
        >
          Delete event
        </Button>
      )}
    </div>
  );
}
