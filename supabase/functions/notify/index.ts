/**
 * Africana — Push, activity email, and lifecycle email dispatcher
 */
import {
  type ActivityNotifyType,
  type LifecycleCampaign,
  escapeHtml,
  getRecipientContext,
  sendEmail,
  sendLifecycleCampaignEmail,
  supabaseAdmin,
} from '../_shared/email-lifecycle.ts';

/** Mobile clients do not rely on browser CORS; avoid wildcard origin. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ActivityNotifyPayload {
  kind?: 'activity';
  type: ActivityNotifyType;
  recipientId: string;
  senderId: string;
  senderName: string;
  extra?: Record<string, string>;
}

interface CampaignNotifyPayload {
  kind: 'campaign';
  campaign: LifecycleCampaign;
  recipientId: string;
  senderName?: string | null;
  extra?: Record<string, string>;
}

type NotifyPayload = ActivityNotifyPayload | CampaignNotifyPayload;

const PUSH_TEMPLATES: Record<
  ActivityNotifyType,
  (name: string) => { title: string; body: string }
> = {
  message: (name) => ({ title: '💬 New message', body: `${name} sent you a message` }),
  like: (name) => ({ title: '❤️ Someone liked you!', body: `${name} liked your profile` }),
  match: (name) => ({ title: "🔥 It's a Match!", body: `You and ${name} liked each other` }),
  view: (name) => ({ title: '👀 Profile view', body: `${name} viewed your profile` }),
  favourite: (name) => ({
    title: '⭐ You were starred',
    body: `${name} added you to their favourites`,
  }),
};

const EMAIL_SUBJECTS: Record<ActivityNotifyType, (name: string) => string> = {
  message: (name) => `💬 ${name} sent you a message on Africana`,
  like: (name) => `❤️ ${name} liked your Africana profile`,
  match: (name) => `🔥 It's a Match! You and ${name} liked each other`,
  view: (name) => `👀 ${name} viewed your Africana profile`,
  favourite: (name) => `⭐ ${name} starred your Africana profile`,
};

async function requireCallerId(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_authorization' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data?.user?.id) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_request' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const callerOrErr = await requireCallerId(req);
  if (callerOrErr instanceof Response) return callerOrErr;
  const callerId = callerOrErr;

  let payload: NotifyPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    if (payload.kind === 'campaign') {
      if (!isUuidString(payload.recipientId)) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_recipient' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }
      if (payload.recipientId !== callerId) {
        return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
          status: 403,
          headers: CORS_HEADERS,
        });
      }
      const result = await sendLifecycleCampaignEmail({
        campaign: payload.campaign,
        recipientId: payload.recipientId,
        senderName: payload.senderName ?? null,
        metadata: payload.extra,
      });

      return new Response(JSON.stringify({ ok: result.ok, reason: result.reason }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    const { type, recipientId, senderId, senderName, extra } = payload;
    if (!isUuidString(recipientId) || !isUuidString(senderId)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_ids' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
    if (senderId !== callerId) {
      return new Response(JSON.stringify({ ok: false, error: 'sender_mismatch' }), {
        status: 403,
        headers: CORS_HEADERS,
      });
    }

    // Block check — never push/email a user about someone they (or the sender) has blocked.
    const { data: blockRow } = await supabaseAdmin
      .from('blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId}),and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId})`,
      )
      .limit(1)
      .maybeSingle();

    if (blockRow) {
      return new Response(JSON.stringify({ ok: false, reason: 'blocked' }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Fetch recipient's push token, notification preferences, and display name.
    //
    // NOTE: maybeSingle() — not single(). A user who has never opened the
    // notification settings sheet may not have a `user_settings` row yet, in
    // which case `single()` returns 406 and the whole notify call 500s.
    // `maybeSingle()` returns `null` and we fall through with sensible
    // defaults (notifications on by default).
    const recipient = await getRecipientContext(recipientId);
    const settings = recipient.settings;

    if (type === 'message' && settings?.receive_messages === false) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'recipient_not_accepting_messages' }),
        {
          status: 200,
          headers: CORS_HEADERS,
        },
      );
    }

    // Check per-type push preference (explicit conditionals avoid TS index issues).
    // Favourites honour `notify_likes` until/unless we ship a dedicated column;
    // this keeps the toggle UX simple (one "Stars & Likes" switch on the client).
    const pushPrefEnabled =
      type === 'message'
        ? settings?.notify_messages !== false
        : type === 'like'
          ? settings?.notify_likes !== false
          : type === 'match'
            ? settings?.notify_matches !== false
            : type === 'view'
              ? settings?.notify_views !== false
              : type === 'favourite'
                ? settings?.notify_likes !== false
                : true;
    const pushEnabled = pushPrefEnabled && !!settings?.push_token;
    const emailEnabled = settings?.email_notifications === true && !!recipient.email;

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
    if (
      emailEnabled &&
      (type === 'like' || type === 'match' || type === 'favourite') &&
      recipient.email
    ) {
      const subject = EMAIL_SUBJECTS[type](senderName);
      const recipientName = recipient.fullName ?? 'there';
      const safeRecipient = escapeHtml(recipientName);
      const safeBody = escapeHtml(template.body);
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h1 style="color:#C84B31;font-size:24px;margin-bottom:8px">Africana 🌍</h1>
          <p style="font-size:16px;color:#1A1A1A">Hi ${safeRecipient},</p>
          <p style="font-size:16px;color:#1A1A1A">${safeBody}.</p>
          <p style="font-size:14px;color:#6B7280;margin-top:24px">
            Open the Africana app to respond. If you'd like to stop receiving these emails,
            you can turn them off in Settings → Notifications.
          </p>
        </div>
      `;
      const emailSent = await sendEmail(recipient.email, subject, html);
      results.email = emailSent ? 'sent' : 'skipped';
    }

    if (!pushEnabled && !emailEnabled) {
      return new Response(JSON.stringify({ ok: false, reason: 'disabled_or_no_token' }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error('[notify]', err);
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
