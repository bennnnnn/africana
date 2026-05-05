import {
  AWAY_CAMPAIGNS,
  getLifecycleCandidates,
  sendLifecycleCampaignEmail,
} from '../_shared/email-lifecycle.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getCutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const results: Array<{ campaign: string; candidates: number; sent: number }> = [];

    for (const milestone of AWAY_CAMPAIGNS) {
      const candidates = await getLifecycleCandidates({
        campaign: milestone.campaign,
        lastSeenBefore: getCutoffIso(milestone.days),
        limit: 500,
      });

      let sent = 0;
      for (const candidate of candidates) {
        const result = await sendLifecycleCampaignEmail({
          campaign: milestone.campaign,
          recipientId: candidate.user_id,
          metadata: {
            source: 'daily-sweep',
            milestoneDays: milestone.days,
            lastSeen: candidate.last_seen,
          },
        });
        if (result.ok) sent += 1;
      }

      results.push({
        campaign: milestone.campaign,
        candidates: candidates.length,
        sent,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
