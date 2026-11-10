export function validateAuthConfig(config) {
  const url = String(config.supabaseUrl || '').trim();
  const key = String(config.publishableKey || '').trim();
  const bucket = String(config.avatarBucket || 'sora-avatars');
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Email auth requires both project URL and publishable key.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Only a Supabase publishable key may be included in the public website.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error('Use the HTTPS project origin as the auth URL.');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket)) throw new Error('Invalid avatar bucket.');
  return { supabaseUrl: parsed.origin, publishableKey: key, avatarBucket: bucket };
}
