/**
 * Africana — Push & Email Notification Edge Function
 *
 * Deploy: npx supabase functions deploy notify
 *
 * Called from the client after:
 *  - A new message is sent
 *  - A user is liked
 *  - A mutual match is created (both users notified)
 *  - A profile is viewed
 *
 * Body: { type, recipientId, senderId, senderName, extra? }
 *
 * Email notifications use Resend (resend.com — free tier: 3 000 emails/month).
 * To enable: set RESEND_API_KEY and RESEND_FROM in Supabase Edge Function secrets.
 *   supabase secrets set RESEND_API_KEY=re_xxxx
 *   supabase secrets set RESEND_FROM=Africana <noreply@yourdomain.com>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const RESEND_API_URL = 'https://api.resend.com/emails';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type NotifyType = 'message' | 'like' | 'match' | 'view' | 'favourite';

interface NotifyPayload {
  type: NotifyType;
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}

const PUSH_TEMPLATES: Record<NotifyType, (name: string) => { title: string; body: string }> = {
  message:   (name) => ({ title: '💬 New message',        body: `${name} sent you a message` }),
  like:      (name) => ({ title: '❤️ Someone liked you!', body: `${name} liked your profile` }),
  match:     (name) => ({ title: '🔥 It\'s a Match!',     body: `You and ${name} liked each other` }),
  view:      (name) => ({ title: '👀 Profile view',       body: `${name} viewed your profile` }),
  favourite: (name) => ({ title: '⭐ You were starred',   body: `${name} added you to their favourites` }),
};

const EMAIL_SUBJECTS: Record<NotifyType, (name: string) => string> = {
  message:   (name) => `💬 ${name} sent you a message on Africana`,
  like:      (name) => `❤️ ${name} liked your Africana profile`,
  match:     (name) => `🔥 It's a Match! You and ${name} liked each other`,
  view:      (name) => `👀 ${name} viewed your Africana profile`,
  favourite: (name) => `⭐ ${name} starred your Africana profile`,
};

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from   = Deno.env.get('RESEND_FROM') ?? 'Africana <noreply@africana.app>';
  if (!apiKey) return; // Email not configured — skip silently
  await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const payload: NotifyPayload = await req.json();
    const { type, recipientId, senderName, extra } = payload;

    // Fetch recipient's push token, email, and notification preferences
    const { data: settings } = await supabase
      .from('user_settings')
      .select(
        'push_token, receive_messages, notify_messages, notify_likes, notify_matches, notify_views, email_notifications',
      )
      .eq('user_id', recipientId)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipientId)
      .single();

    if (type === 'message' && settings?.receive_messages === false) {
      return new Response(JSON.stringify({ ok: false, reason: 'recipient_not_accepting_messages' }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Check per-type push preference (explicit conditionals avoid TS index issues).
    // Favourites honour `notify_likes` until/unless we ship a dedicated column;
    // this keeps the toggle UX simple (one "Stars & Likes" switch on the client).
    const pushPrefEnabled =
      type === 'message'   ? settings?.notify_messages !== false :
      type === 'like'      ? settings?.notify_likes    !== false :
      type === 'match'     ? settings?.notify_matches  !== false :
      type === 'view'      ? settings?.notify_views    !== false :
      type === 'favourite' ? settings?.notify_likes    !== false :
      true;
    const pushEnabled = pushPrefEnabled && !!settings?.push_token;
    const emailEnabled = settings?.email_notifications === true && !!profile?.email;

    const template = PUSH_TEMPLATES[type](senderName);
    const results: Record<string, unknown> = {};

    // ── Push notification ──────────────────────────────────────────────────────
    if (pushEnabled) {
      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: settings!.push_token,
          title: template.title,
          body: template.body,
          sound: 'default',
          priority: type === 'message' ? 'high' : 'normal',
          data: extra ?? {},
          channelId: type,
        }),
      });
      results.push = await pushRes.json();
    }

    // ── Email notification (re-engagement only for non-message types) ──────────
    // Only send email for likes, matches, and stars (not every message — too spammy).
    if (emailEnabled && (type === 'like' || type === 'match' || type === 'favourite') && profile?.email) {
      const subject = EMAIL_SUBJECTS[type](senderName);
      const recipientName = profile.full_name ?? 'there';
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h1 style="color:#C84B31;font-size:24px;margin-bottom:8px">Africana 🌍</h1>
          <p style="font-size:16px;color:#1A1A1A">Hi ${recipientName},</p>
          <p style="font-size:16px;color:#1A1A1A">${template.body}.</p>
          <p style="font-size:14px;color:#6B7280;margin-top:24px">
            Open the Africana app to respond. If you'd like to stop receiving these emails,
            you can turn them off in Settings → Notifications.
          </p>
        </div>
      `;
      await sendEmail(profile.email, subject, html);
      results.email = 'sent';
    }

    if (!pushEnabled && !emailEnabled) {
      return new Response(JSON.stringify({ ok: false, reason: 'disabled_or_no_token' }), { status: 200, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: CORS_HEADERS });
  }
});
