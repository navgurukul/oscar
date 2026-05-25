// Thin Resend wrapper. Returns a no-op stub when RESEND_API_KEY is missing
// so local dev + envs that have not configured email keep working — invite
// rows still land in the DB and the invite link is the fallback.

import { Resend } from "resend";

const DEFAULT_FROM = "Oscar <invites@oscar.app>";

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
}

export function isEmailEnabled(): boolean {
  return !!getApiKey();
}

export interface InviteEmailParams {
  toEmail: string;
  organizationName: string;
  inviterName: string | null;
  inviterEmail: string | null;
  inviteUrl: string;
  expiresAt: string | null;
}

function renderInviteHtml(params: InviteEmailParams): string {
  const inviterLabel =
    params.inviterName ||
    params.inviterEmail ||
    "A teammate";
  const expiry = params.expiresAt
    ? new Date(params.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f0d0a; color: #efeae0; padding: 32px; margin: 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #1a1714; border: 1px solid rgba(184, 98, 61, 0.28); border-radius: 16px; padding: 28px;">
      <tr>
        <td>
          <h1 style="margin: 0 0 8px; font-size: 22px; color: #f9fafb;">Join ${escapeHtml(params.organizationName)} on Oscar</h1>
          <p style="margin: 0 0 16px; color: #9ca3af;">${escapeHtml(inviterLabel)} has invited you to collaborate.</p>
          <p style="margin: 0 0 24px; color: #d1d5db; line-height: 1.5;">
            Oscar is a voice note app. Joining the <strong>${escapeHtml(params.organizationName)}</strong> workspace gives you access to shared scribbles, meeting minutes, and reference documents.
          </p>
          <a href="${params.inviteUrl}" style="display: inline-block; padding: 12px 20px; background: #b8623d; color: #f7f4ee; font-weight: 600; text-decoration: none; border-radius: 10px;">Accept invite</a>
          <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">
            Or open this link directly:<br />
            <a href="${params.inviteUrl}" style="color: #e8c9b8; word-break: break-all;">${params.inviteUrl}</a>
          </p>
          ${expiry ? `<p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">This invite expires on ${expiry}.</p>` : ""}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderInviteText(params: InviteEmailParams): string {
  const inviter = params.inviterName || params.inviterEmail || "A teammate";
  return [
    `${inviter} has invited you to join ${params.organizationName} on Oscar.`,
    "",
    `Accept your invite: ${params.inviteUrl}`,
    params.expiresAt ? `Expires: ${params.expiresAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendInviteEmail(
  params: InviteEmailParams
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const client = new Resend(apiKey);
    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: params.toEmail,
      subject: `${params.inviterName ?? "A teammate"} invited you to ${params.organizationName} on Oscar`,
      html: renderInviteHtml(params),
      text: renderInviteText(params),
    });

    if (error || !data) {
      return { ok: false, reason: error?.message ?? "Unknown Resend error" };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}
