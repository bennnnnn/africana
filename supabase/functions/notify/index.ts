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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const RESEND_API_URL = 'https://api.resend.com/emails';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type NotifyType = 'message' | 'like' | 'match' | 'view';

interface NotifyPayload {
  type: NotifyType;
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}

const PUSH_TEMPLATES: Record<NotifyType, (name: string) => { title: string; body: string }> = {
  message: (name) => ({ title: '💬 New message',       body: `${name} sent you a message` }),
  like:    (name) => ({ title: '❤️ Someone liked you!', body: `${name} liked your profile` }),
  match:   (name) => ({ title: '🔥 It\'s a Match!',    body: `You and ${name} liked each other` }),
  view:    (name) => ({ title: '👀 Profile view',       body: `${name} viewed your profile` }),
};

const EMAIL_SUBJECTS: Record<NotifyType, (name: string) => string> = {
  message: (name) => `💬 ${name} sent you a message on Africana`,
  like:    (name) => `❤️ ${name} liked your Africana profile`,
  match:   (name) => `🔥 It's a Match! You and ${name} liked each other`,
  view:    (name) => `👀 ${name} viewed your Africana profile`,
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
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload: NotifyPayload = await req.json();
    const { type, recipientId, senderName, extra } = payload;

    // Fetch recipient's push token, email, and notification preferences
    const { data: settings } = await supabase
      .from('user_settings')
      .select('push_token, notify_messages, notify_likes, notify_matches, notify_views, email_notifications')
      .eq('user_id', recipientId)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipientId)
      .single();

    // Check per-type push preference
    const prefMap: Record<NotifyType, keyof typeof settings> = {
      message: 'notify_messages',
      like:    'notify_likes',
      match:   'notify_matches',
      view:    'notify_views',
    };
    const pref = settings?.[prefMap[type]];
    const pushEnabled = pref !== false && !!settings?.push_token;
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
    // Only send email for likes and matches (not every message — too spammy).
    if (emailEnabled && (type === 'like' || type === 'match') && profile?.email) {
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
      return new Response(JSON.stringify({ ok: false, reason: 'disabled_or_no_token' }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
