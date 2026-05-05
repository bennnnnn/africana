import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ActivityNotifyType = 'message' | 'like' | 'match' | 'view' | 'favourite';

export type LifecycleCampaign =
  | 'welcome'
  | 'first_message'
  | 'first_like'
  | 'away_3d'
  | 'away_7d'
  | 'away_14d'
  | 'away_21d'
  | 'away_30d';

export const AWAY_CAMPAIGNS: ReadonlyArray<{ campaign: LifecycleCampaign; days: number }> = [
  { campaign: 'away_3d', days: 3 },
  { campaign: 'away_7d', days: 7 },
  { campaign: 'away_14d', days: 14 },
  { campaign: 'away_21d', days: 21 },
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
  | { ok: false; reason: 'missing_email' | 'already_sent' | 'delivery_unavailable' };

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') ?? 'Africana <noreply@africana.app>';
  if (!apiKey) return false;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}`);
  }

  return true;
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
    supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', recipientId)
      .maybeSingle(),
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
    case 'away_3d':
      return {
        subject: "It's been 3 days since you last opened Africana",
        html: renderEmailHtml({
          heading: 'Come back and see who is waiting',
          recipientName: params.recipientName,
          body: "It's been 3 days since your last visit. Open Africana to catch up on new likes, matches, and messages.",
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
    case 'away_21d':
      return {
        subject: "It's been 21 days since you last opened Africana",
        html: renderEmailHtml({
          heading: 'Your next connection could be waiting',
          recipientName: params.recipientName,
          body: "It's been 21 days since your last visit. Open Africana and meet the people who found you.",
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
  if (!recipient.email) {
    return { ok: false, reason: 'missing_email' };
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
