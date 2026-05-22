/**
 * Verified session → service-role RPC `delete_user_by_id`. Removes public `delete_user` RPC (linter 0029).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Mobile clients do not rely on browser CORS; avoid wildcard origin. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const admin = createClient(url, service);
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(jwt);
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const storageErr = await removeUserStorageObjects(admin, user.id);
  if (storageErr) {
    return new Response(JSON.stringify({ error: storageErr.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { error: rpcErr } = await admin.rpc('delete_user_by_id', { p_user_id: user.id });
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

async function removeUserStorageObjects(admin: ReturnType<typeof createClient>, userId: string) {
  const buckets = ['avatars', 'profile-photos', 'verification-photos'];
  for (const bucket of buckets) {
    const { data: objects, error: listErr } = await admin.storage.from(bucket).list(userId, {
      limit: 1000,
    });
    if (listErr) return listErr;

    const paths = (objects ?? [])
      .filter((object) => object.name)
      .map((object) => `${userId}/${object.name}`);
    if (paths.length === 0) continue;

    const { error: removeErr } = await admin.storage.from(bucket).remove(paths);
    if (removeErr) return removeErr;
  }
  return null;
}
