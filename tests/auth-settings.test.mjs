import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthConfig } from '../scripts/auth-settings.mjs';
const valid = { supabaseUrl: 'https://example.supabase.co/', publishableKey: 'sb_publishable_test', avatarBucket: 'sora-avatars' };
test('allows a deliberate unconfigured state without using an external service', () => {
  assert.equal(validateAuthConfig({}), null);
  assert.throws(() => validateAuthConfig({ supabaseUrl: valid.supabaseUrl }));
});
test('uses only public browser settings and a normalized HTTPS origin', () => {
  assert.deepEqual(validateAuthConfig(valid), { ...valid, supabaseUrl: 'https://example.supabase.co' });
});
test('blocks server keys and legacy credentials from the browser bundle', () => {
  for (const publishableKey of ['sb_secret_private', 'eyJhbGciOiJIUzI1NiJ9.service_role', 'not-a-publishable-key']) {
    assert.throws(() => validateAuthConfig({ ...valid, publishableKey }));
  }
});
test('rejects credentials in URLs and non-HTTPS or malformed endpoints', () => {
  for (const supabaseUrl of ['http://example.supabase.co', 'https://name:password@example.supabase.co', 'https://example.supabase.co/path', 'https://example.supabase.co?token=private', 'https://example.supabase.co#private', 'file:///tmp/project']) {
    assert.throws(() => validateAuthConfig({ ...valid, supabaseUrl }));
  }
  assert.throws(() => validateAuthConfig({ ...valid, avatarBucket: '../other-bucket' }));
});
