import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailMode = "log" | "resend";

export class EmailSendError extends Error {
  readonly status?: number;
  readonly providerBody?: string;
  constructor(message: string, opts?: { status?: number; providerBody?: string }) {
    super(message);
    this.name = "EmailSendError";
    this.status = opts?.status;
    this.providerBody = opts?.providerBody;
  }
}

function mode(): EmailMode {
  const raw = process.env.EMAIL_MODE?.trim().toLowerCase();
  if (raw === "resend") return "resend";
  return "log";
}

function baseUrl(): string {
  return (process.env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "events@li.finance";
}

export type ApprovalEmailInput = {
  eventId: string;
  eventTitle: string;
  approverDisplayName: string;
  approverEmail: string;
  approvalToken: string;
  teamNames: string[];
};

export type SubmissionNotifyInput = {
  eventId: string;
  eventTitle: string;
  recipientDisplayName: string;
  recipientEmail: string;
  approverDisplayName: string;
  approvedCount: number;
  isUpdate: boolean;
};

export type SendResult = {
  mode: EmailMode;
  to: string;
  subject: string;
  link: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailBodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "meta"; items: Array<{ label: string; value: string }> }
  | { kind: "cta"; label: string; href: string }
  | { kind: "fallbackLink"; href: string };

function renderHtml(args: {
  preheader: string;
  heading: string;
  blocks: EmailBodyBlock[];
}): string {
  const blocks = args.blocks
    .map((b) => {
      if (b.kind === "paragraph") {
        return `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1f1d2b">${escapeHtml(b.text)}</p>`;
      }
      if (b.kind === "meta") {
        const rows = b.items
          .map(
            (it) =>
              `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:#6b6786;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;vertical-align:top">${escapeHtml(it.label)}</td><td style="padding:4px 0;font-size:14px;color:#1f1d2b">${escapeHtml(it.value)}</td></tr>`,
          )
          .join("");
        return `<table role="presentation" style="border-collapse:collapse;margin:0 0 20px">${rows}</table>`;
      }
      if (b.kind === "cta") {
        return `<p style="margin:24px 0"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#5b5bf5;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none">${escapeHtml(b.label)}</a></p>`;
      }
      return `<p style="margin:0 0 16px;font-size:12px;color:#6b6786;line-height:1.5">If the button doesn't work, paste this link:<br/><a href="${escapeHtml(b.href)}" style="color:#5b5bf5;word-break:break-all">${escapeHtml(b.href)}</a></p>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(args.heading)}</title></head><body style="margin:0;padding:0;background:#f3f1fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f1d2b">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1fb;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e7e4f2;border-radius:16px;box-shadow:0 1px 3px rgba(22,18,64,.06);overflow:hidden">
<tr><td style="padding:20px 28px;border-bottom:1px solid #f0edf7">
<div style="display:flex;align-items:center;gap:10px">
<span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#8b82ff 0%,#5b5bf5 100%)"></span>
<span style="font-size:14px;font-weight:600;color:#1f1d2b;letter-spacing:-.01em">LI.Events</span>
</div>
</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#1f1d2b;letter-spacing:-.01em">${escapeHtml(args.heading)}</h1>
${blocks}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #f0edf7;font-size:12px;color:#6b6786">LI.Events · internal tool for li.finance workspace ops</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function deliver(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  link: string;
  logTag: string;
}): Promise<SendResult> {
  const current = mode();
  if (current === "log") {
    console.log(`[email:log ${args.logTag}]`, {
      to: args.to,
      from: fromAddress(),
      subject: args.subject,
      link: args.link,
      text: args.text,
    });
    return { mode: "log", to: args.to, subject: args.subject, link: args.link };
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new EmailSendError(
      "EMAIL_MODE=resend but RESEND_API_KEY is not set.",
    );
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[email:resend] send failed", {
      status: res.status,
      to: args.to,
      subject: args.subject,
      providerBody: text.slice(0, 500),
    });
    throw new EmailSendError(`Resend returned ${res.status}`, {
      status: res.status,
      providerBody: text,
    });
  }

  return { mode: "resend", to: args.to, subject: args.subject, link: args.link };
}

export async function sendApprovalEmail(input: ApprovalEmailInput): Promise<SendResult> {
  const link = `${baseUrl()}/approve/${input.approvalToken}`;
  const subject = `Approve attendees for "${input.eventTitle}"`;
  const teamsLine =
    input.teamNames.length > 0 ? input.teamNames.join(", ") : "(no teams attached)";
  const text = [
    `Hi ${input.approverDisplayName},`,
    ``,
    `The workspace manager needs your approval on attendees for "${input.eventTitle}".`,
    `Teams: ${teamsLine}`,
    ``,
    `Pick the eligible travelers here (link does not expire; bookmark to revisit):`,
    link,
    ``,
    `— LI.Events`,
  ].join("\n");

  const html = renderHtml({
    preheader: `Approve attendees for ${input.eventTitle}`,
    heading: `Approve attendees for "${input.eventTitle}"`,
    blocks: [
      {
        kind: "paragraph",
        text: `Hi ${input.approverDisplayName}, the workspace manager needs your approval on who should travel.`,
      },
      {
        kind: "meta",
        items: [
          { label: "Event", value: input.eventTitle },
          { label: "Teams", value: teamsLine },
        ],
      },
      { kind: "cta", label: "Pick eligible travelers", href: link },
      {
        kind: "paragraph",
        text: "You can come back and edit this anytime — bookmark the link or ask the workspace manager to resend it.",
      },
      { kind: "fallbackLink", href: link },
    ],
  });

  return deliver({
    to: input.approverEmail,
    subject,
    text,
    html,
    link,
    logTag: "approval",
  });
}

export async function sendSubmissionNotifyEmail(
  input: SubmissionNotifyInput,
): Promise<SendResult> {
  const link = `${baseUrl()}/events/${input.eventId}`;
  const verb = input.isUpdate ? "updated" : "submitted";
  const subject = `Attendees ${verb} for "${input.eventTitle}"`;
  const countLine = `${input.approvedCount} ${input.approvedCount === 1 ? "person" : "people"} approved.`;
  const text = [
    `Hi ${input.recipientDisplayName},`,
    ``,
    `${input.approverDisplayName} has ${verb} approvals for "${input.eventTitle}".`,
    countLine,
    ``,
    `See the full list here:`,
    link,
    ``,
    `— LI.Events`,
  ].join("\n");

  const html = renderHtml({
    preheader: `${countLine} — ${input.eventTitle}`,
    heading: `Attendees ${verb} for "${input.eventTitle}"`,
    blocks: [
      {
        kind: "paragraph",
        text: `Hi ${input.recipientDisplayName}, ${input.approverDisplayName} just ${verb} their approval for "${input.eventTitle}".`,
      },
      {
        kind: "meta",
        items: [
          { label: "Event", value: input.eventTitle },
          { label: "Approver", value: input.approverDisplayName },
          { label: "Approved", value: String(input.approvedCount) },
        ],
      },
      { kind: "cta", label: "View approved list", href: link },
      { kind: "fallbackLink", href: link },
    ],
  });

  return deliver({
    to: input.recipientEmail,
    subject,
    text,
    html,
    link,
    logTag: "notify",
  });
}
