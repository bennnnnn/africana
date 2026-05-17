import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4';

export type ActivityNotifyType = 'message' | 'like' | 'match' | 'view' | 'favourite';

export type LifecycleCampaign =
  | 'welcome'
  | 'first_message'
  | 'first_like'
  | 'away_7d'
  | 'away_14d'
  | 'away_30d';

/** Inactivity milestones (by `profiles.last_seen`). Push is tried first; email only if opted in. */
export const AWAY_CAMPAIGNS: ReadonlyArray<{ campaign: LifecycleCampaign; days: number }> = [
  { campaign: 'away_7d', days: 7 },
  { campaign: 'away_14d', days: 14 },
  { campaign: 'away_30d', days: 30 },
];

type RecipientSettings = {
  push_token: string | null;
  receive_messages: boolean | null;
  notify_messages: boolean | null;
  notify_likes: boolean | null;
  notify_matches: boolean | null;
  notify_views: boolean | null;
  email_notifications: boolean | null;
};

export type RecipientContext = {
  fullName: string | null;
  email: string | null;
  settings: RecipientSettings | null;
};

type LifecycleEmailResult =
  | { ok: true; reason: 'sent' }
  | {
      ok: false;
      reason: 'missing_email' | 'already_sent' | 'delivery_unavailable' | 'nothing_to_send';
    };

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function getResend(): Resend | null {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function sendExpoPush(params: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<boolean> {
  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: params.to,
      title: params.title,
      body: params.body,
      sound: 'default',
      priority: 'normal' as const,
      data: params.data ?? {},
      channelId: 'match',
    }),
  });
  let json: unknown;
  try {
    json = await pushRes.json();
  } catch {
    return false;
  }
  if (!pushRes.ok) return false;
  const data = json as { data?: Array<{ status?: string }> };
  return Array.isArray(data.data) && data.data.some((d) => d.status === 'ok');
}

function getAwayPushCopy(campaign: LifecycleCampaign): { title: string; body: string } {
  switch (campaign) {
    case 'away_7d':
      return {
        title: 'Your matches miss you',
        body: "It's been a week — open Africana and see who's ready to talk.",
      };
    case 'away_14d':
      return {
        title: 'Still time to reconnect',
        body: "It's been two weeks. Jump back in and catch up on Africana.",
      };
    case 'away_30d':
      return {
        title: 'Ready to come back?',
        body: "It's been a while — open Africana and see who's waiting.",
      };
    default:
      return { title: 'We miss you', body: 'Open Africana to catch up.' };
  }
}

/** Shared by Edge Functions that build HTML (activity emails, etc.). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const from = Deno.env.get('RESEND_FROM') ?? 'Africana <noreply@africana.app>';

  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    console.error('[resend]', error);
    throw new Error(`Resend error: ${error.message}`);
  }

  return !!data?.id;
}

export async function getRecipientContext(recipientId: string): Promise<RecipientContext> {
  const [{ data: settings }, { data: profileRow }, { data: authUser }] = await Promise.all([
    supabaseAdmin
      .from('user_settings')
      .select(
        'push_token, receive_messages, notify_messages, notify_likes, notify_matches, notify_views, email_notifications',
      )
      .eq('user_id', recipientId)
      .maybeSingle(),
    supabaseAdmin.from('profiles').select('full_name').eq('id', recipientId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(recipientId),
  ]);

  return {
    fullName: profileRow?.full_name ?? null,
    email: authUser?.user?.email ?? null,
    settings: settings ?? null,
  };
}

function renderEmailHtml(params: {
  heading: string;
  recipientName: string;
  body: string;
  footer?: string;
}): string {
  const recipientName = escapeHtml(params.recipientName);
  const heading = escapeHtml(params.heading);
  const body = escapeHtml(params.body);
  const footer = params.footer ? escapeHtml(params.footer) : null;

  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A1A1A">
      <div style="font-size:28px;font-weight:700;color:#C84B31;margin-bottom:16px">Africana</div>
      <div style="font-size:24px;font-weight:700;margin-bottom:12px">${heading}</div>
      <p style="font-size:16px;line-height:24px;margin:0 0 12px">Hi ${recipientName},</p>
      <p style="font-size:16px;line-height:24px;margin:0 0 12px">${body}</p>
      <p style="font-size:14px;line-height:22px;color:#6B7280;margin:20px 0 0">
        Open Africana to keep the conversation going.
      </p>
      ${footer ? `<p style="font-size:13px;line-height:20px;color:#6B7280;margin:12px 0 0">${footer}</p>` : ''}
    </div>
  `;
}

function getLifecycleTemplate(
  campaign: LifecycleCampaign,
  params: { recipientName: string; senderName?: string | null },
): { subject: string; html: string } {
  const senderName = params.senderName?.trim() || 'Someone';

  switch (campaign) {
    case 'welcome':
      return {
        subject: 'Welcome to Africana',
        html: renderEmailHtml({
          heading: 'Your account is ready',
          recipientName: params.recipientName,
          body: 'Welcome to Africana. Complete your profile, say hello, and start meeting people across Africa and the diaspora.',
        }),
      };
    case 'first_message':
      return {
        subject: 'You got your first message on Africana',
        html: renderEmailHtml({
          heading: 'Your first message is here',
          recipientName: params.recipientName,
          body: `${senderName} sent you a message. Open Africana to reply.`,
        }),
      };
    case 'first_like':
      return {
        subject: 'You got your first like on Africana',
        html: renderEmailHtml({
          heading: 'Someone noticed you',
          recipientName: params.recipientName,
          body: `${senderName} liked your profile. Open Africana to see who noticed you.`,
        }),
      };
    case 'away_7d':
      return {
        subject: "It's been 7 days since you last opened Africana",
        html: renderEmailHtml({
          heading: 'Your matches miss you',
          recipientName: params.recipientName,
          body: "It's been a week since your last visit. Open Africana and see who is ready to talk.",
        }),
      };
    case 'away_14d':
      return {
        subject: "It's been 14 days since you last opened Africana",
        html: renderEmailHtml({
          heading: 'There is still time to reconnect',
          recipientName: params.recipientName,
          body: "It's been 14 days since you last opened Africana. Come back and see what you have missed.",
        }),
      };
    case 'away_30d':
      return {
        subject: "It's been 30 days since you last opened Africana",
        html: renderEmailHtml({
          heading: 'Ready to come back?',
          recipientName: params.recipientName,
          body: "It's been a month since you last opened Africana. Jump back in and see who is waiting for you.",
        }),
      };
  }
}

export async function claimLifecycleCampaignEvent(params: {
  recipientId: string;
  campaign: LifecycleCampaign;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('claim_email_campaign_event', {
    p_user_id: params.recipientId,
    p_campaign_key: params.campaign,
    p_trigger_metadata: params.metadata ?? {},
  });

  if (error) throw error;
  return data === true;
}

export async function getLifecycleCandidates(params: {
  campaign: LifecycleCampaign;
  lastSeenBefore: string;
  limit?: number;
}): Promise<Array<{ user_id: string; full_name: string | null; last_seen: string }>> {
  const { data, error } = await supabaseAdmin.rpc('get_email_campaign_candidates', {
    p_campaign_key: params.campaign,
    p_last_seen_before: params.lastSeenBefore,
    p_limit: params.limit ?? 500,
  });

  if (error) throw error;
  return (data ?? []) as Array<{ user_id: string; full_name: string | null; last_seen: string }>;
}

export async function sendLifecycleCampaignEmail(params: {
  campaign: LifecycleCampaign;
  recipientId: string;
  senderName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<LifecycleEmailResult> {
  const recipient = await getRecipientContext(params.recipientId);
  const isAwayCampaign = AWAY_CAMPAIGNS.some((c) => c.campaign === params.campaign);

  if (isAwayCampaign) {
    const canPush = !!recipient.settings?.push_token;
    const canEmail = recipient.settings?.email_notifications === true && !!recipient.email;
    if (!canPush && !canEmail) {
      return { ok: false, reason: 'nothing_to_send' };
    }

    const claimed = await claimLifecycleCampaignEvent({
      recipientId: params.recipientId,
      campaign: params.campaign,
      metadata: params.metadata,
    });
    if (!claimed) {
      return { ok: false, reason: 'already_sent' };
    }

    const recipientName = recipient.fullName?.trim() || 'there';
    const pushCopy = getAwayPushCopy(params.campaign);
    let pushOk = false;
    let emailOk = false;

    if (canPush && recipient.settings?.push_token) {
      try {
        pushOk = await sendExpoPush({
          to: recipient.settings.push_token,
          title: pushCopy.title,
          body: pushCopy.body,
          data: { kind: 'lifecycle', campaign: params.campaign },
        });
      } catch {
        pushOk = false;
      }
    }

    if (canEmail && recipient.email) {
      const template = getLifecycleTemplate(params.campaign, {
        recipientName,
        senderName: params.senderName,
      });
      try {
        emailOk = await sendEmail(recipient.email, template.subject, template.html);
      } catch {
        emailOk = false;
      }
    }

    if (!pushOk && !emailOk) {
      await supabaseAdmin
        .from('email_campaign_events')
        .delete()
        .eq('user_id', params.recipientId)
        .eq('campaign_key', params.campaign);
      return { ok: false, reason: 'delivery_unavailable' };
    }

    return { ok: true, reason: 'sent' };
  }

  if (!recipient.email) {
    return { ok: false, reason: 'missing_email' };
  }

  if (recipient.settings?.email_notifications !== true) {
    return { ok: false, reason: 'nothing_to_send' };
  }

  const claimed = await claimLifecycleCampaignEvent({
    recipientId: params.recipientId,
    campaign: params.campaign,
    metadata: params.metadata,
  });
  if (!claimed) {
    return { ok: false, reason: 'already_sent' };
  }

  const recipientName = recipient.fullName?.trim() || 'there';
  const template = getLifecycleTemplate(params.campaign, {
    recipientName,
    senderName: params.senderName,
  });

  try {
    const sent = await sendEmail(recipient.email, template.subject, template.html);
    if (!sent) {
      await supabaseAdmin
        .from('email_campaign_events')
        .delete()
        .eq('user_id', params.recipientId)
        .eq('campaign_key', params.campaign);
      return { ok: false, reason: 'delivery_unavailable' };
    }
  } catch (error) {
    await supabaseAdmin
      .from('email_campaign_events')
      .delete()
      .eq('user_id', params.recipientId)
      .eq('campaign_key', params.campaign);
    throw error;
  }

  return { ok: true, reason: 'sent' };
}
