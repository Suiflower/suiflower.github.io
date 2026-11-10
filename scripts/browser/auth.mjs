import { createClient } from '@supabase/supabase-js';
import { authConfig } from '../../public/v2/assets/auth-config.js';
import { validateAuthConfig } from '../auth-settings.mjs';

const account = document.querySelector('.account-toggle');
const dialog = document.querySelector('#account-dialog');
const find = selector => dialog.querySelector(selector);
const emailForm = find('[data-email-form]');
const codeForm = find('[data-code-form]');
const emailInput = find('#auth-email');
const codeInput = find('#auth-code');
const sendButton = find('[data-send-code]');
const verifyButton = find('[data-verify-code]');
const resendButton = find('[data-resend-code]');
const uploadButton = find('[data-upload-avatar]');
const avatarInput = find('[data-avatar-file]');
const logoutButton = find('[data-sign-out]');
const errorBox = find('[data-auth-error]');
const statusBox = find('[data-auth-status]');
let client = null;
let settings = null;
let user = null;
let pendingEmail = '';
let busy = false;
let resendAt = 0;
let timer = null;
let avatarObjectUrl = '';
let avatarIdentity = '';
let avatarRequest = 0;

function message(text, error = false) {
  errorBox.hidden = true;
  statusBox.hidden = true;
  const box = error ? errorBox : statusBox;
  box.textContent = text;
  box.hidden = !text;
}
function friendlyError(error) {
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return '请求太频繁，请稍等一分钟再试。';
  if (['otp_expired', 'invalid_credentials'].includes(error?.code)) return '验证码无效或已过期，请检查后重试，或重新发送。';
  if (['email_address_invalid', 'validation_failed'].includes(error?.code)) return '请检查邮箱地址或验证码是否正确。';
  if (['email_address_not_authorized', 'email_provider_disabled', 'signup_disabled'].includes(error?.code)) return '暂时无法向这个邮箱发送验证码，请联系站长。';
  return '暂时无法完成操作，请检查网络后重试。';
}
function updateButtons() {
  const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  sendButton.disabled = !client || busy || remaining > 0;
  resendButton.disabled = !client || busy || remaining > 0;
  verifyButton.disabled = !client || busy;
  find('[data-change-email]').disabled = busy;
  emailInput.disabled = !client || busy;
  codeInput.disabled = busy;
  uploadButton.disabled = busy;
  logoutButton.disabled = busy;
  sendButton.textContent = busy && !pendingEmail ? '正在发送…' : (remaining ? `${remaining} 秒后重发` : '发送验证码');
  resendButton.textContent = remaining ? `${remaining} 秒后重发` : '重新发送';
  verifyButton.textContent = busy ? '正在验证…' : '验证并登录';
}
function startCooldown() {
  resendAt = Date.now() + 60_000;
  clearInterval(timer);
  updateButtons();
  timer = setInterval(() => {
    updateButtons();
    if (Date.now() >= resendAt) clearInterval(timer);
  }, 1000);
}
function avatarPath(currentUser) {
  const path = currentUser?.user_metadata?.avatar_path;
  return currentUser && path === `${currentUser.id}/avatar.jpg` ? path : '';
}
async function loadAvatar(currentUser) {
  const path = avatarPath(currentUser);
  if (!client || !path) return;
  const request = ++avatarRequest;
  try {
    const { data, error } = await client.storage.from(settings.avatarBucket).download(path);
    if (error || request !== avatarRequest || user?.id !== currentUser.id) return;
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = URL.createObjectURL(data);
    for (const [img, fallback] of [
      [account.querySelector('.account-avatar'), account.querySelector('.account-initials')],
      [find('.profile-avatar'), find('.profile-initials')],
    ]) {
      img.src = avatarObjectUrl;
      img.hidden = false;
      fallback.hidden = true;
    }
  } catch { /* Keep the initial avatar when the private image cannot be loaded. */ }
}
function renderUser(currentUser) {
  user = currentUser;
  const loggedIn = Boolean(user);
  find('[data-auth-guest]').hidden = loggedIn;
  find('[data-auth-profile]').hidden = !loggedIn;
  find('#auth-title').textContent = loggedIn ? '我的账号' : '登录 / 注册';
  find('#auth-description').textContent = loggedIn ? '欢迎回到 Sora’s Garden。' : '用邮箱接收验证码，新邮箱验证后自动注册。';
  account.setAttribute('aria-label', loggedIn ? '打开我的账号' : '登录或注册');
  account.title = loggedIn ? '我的账号' : '登录 / 注册';
  account.querySelector('.account-placeholder').hidden = loggedIn;
  const initials = Array.from(user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'S').slice(0, 2).join('').toLocaleUpperCase();
  const identity = user ? `${user.id}:${user.user_metadata?.avatar_updated_at || ''}` : '';
  if (identity !== avatarIdentity) {
    avatarIdentity = identity;
    avatarRequest++;
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = '';
  }
  const url = avatarPath(user) ? avatarObjectUrl : '';
  for (const [img, fallback] of [
    [account.querySelector('.account-avatar'), account.querySelector('.account-initials')],
    [find('.profile-avatar'), find('.profile-initials')],
  ]) {
    fallback.textContent = initials;
    fallback.hidden = !loggedIn || Boolean(url);
    img.hidden = !loggedIn || !url;
    if (url) img.src = url;
    else img.removeAttribute('src');
    img.onerror = () => { img.hidden = true; fallback.hidden = !user; };
  }
  find('[data-profile-email]').textContent = user?.email || '';
  if (user && avatarPath(user) && !url) { const currentUser = user; setTimeout(() => { void loadAvatar(currentUser); }, 0); }
  if (loggedIn) {
    pendingEmail = '';
    codeInput.value = '';
  }
}
account.addEventListener('click', () => {
  message('');
  renderUser(user);
  updateButtons();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
  const focusTarget = user ? find('.auth-close') : (!emailForm.hidden && client ? emailInput : find('.auth-close'));
  focusTarget.focus();
});
find('.auth-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); codeInput.value = ''; });
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});

async function requestCode(resend = false) {
  if (!client || busy || Date.now() < resendAt) return;
  const email = resend ? pendingEmail : emailInput.value.trim();
  if (!resend && !emailForm.reportValidity()) return;
  message('');
  busy = true;
  updateButtons();
  try {
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
    pendingEmail = email;
    emailForm.hidden = true;
    codeForm.hidden = false;
    find('[data-sent-email]').textContent = email;
    startCooldown();
    codeInput.value = '';
    message('请查看邮箱，也可以检查垃圾邮件文件夹。');
  } catch (error) {
    if (error?.status === 429) startCooldown();
    message(friendlyError(error), true);
  } finally {
    busy = false;
    updateButtons();
    if (!codeForm.hidden) codeInput.focus();
  }
}
emailForm.addEventListener('submit', event => { event.preventDefault(); void requestCode(); });
resendButton.addEventListener('click', () => { void requestCode(true); });
find('[data-change-email]').addEventListener('click', () => {
  if (busy) return;
  emailForm.hidden = false;
  codeForm.hidden = true;
  pendingEmail = '';
  codeInput.value = '';
  message('');
  updateButtons();
  emailInput.focus();
});
codeForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!client || busy || !pendingEmail || !codeForm.reportValidity()) return;
  message('');
  busy = true;
  updateButtons();
  try {
    const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token: codeInput.value.trim(), type: 'email' });
    if (error) throw error;
    if (!data.session || !data.user) throw new Error('No authenticated session returned');
    renderUser(data.user);
    message('登录成功。');
  } catch (error) { message(friendlyError(error), true); }
  finally { busy = false; updateButtons(); }
});
logoutButton.addEventListener('click', async () => {
  if (!client || busy) return;
  busy = true;
  updateButtons();
  message('');
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    renderUser(null);
    emailForm.hidden = false;
    codeForm.hidden = true;
    emailInput.value = '';
    message('已退出登录。');
  } catch (error) { message(friendlyError(error), true); }
  finally { busy = false; updateButtons(); }
});

async function resizeAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('avatar_file');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error('avatar_file');
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const size = Math.min(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5f5f2';
    context.fillRect(0, 0, 384, 384);
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 384, 384);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('avatar_file')), 'image/jpeg', .86));
  } finally { bitmap.close(); }
}
uploadButton.addEventListener('click', () => { if (user && !busy) avatarInput.click(); });
avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files?.[0];
  if (!file || !client || !user || busy) return;
  busy = true;
  updateButtons();
  uploadButton.textContent = '正在上传…';
  message('');
  try {
    const avatar = await resizeAvatar(file);
    const path = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await client.storage.from(settings.avatarBucket).upload(path, avatar, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { data, error } = await client.auth.updateUser({ data: { avatar_path: path, avatar_updated_at: Date.now() } });
    if (error) throw error;
    renderUser(data.user);
    message('头像已更新。');
  } catch (error) { message(error?.message === 'avatar_file' ? '请选择 5 MB 以内的 JPG、PNG 或 WebP 图片。' : '头像暂时上传失败，请稍后重试。', true); }
  finally { busy = false; uploadButton.textContent = '更换头像'; avatarInput.value = ''; updateButtons(); }
});

renderUser(null);
try { settings = validateAuthConfig(authConfig); } catch { settings = null; }
if (settings) {
  client = createClient(settings.supabaseUrl, settings.publishableKey, { auth: { storageKey: 'sora-garden-v2-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  client.auth.onAuthStateChange((_event, session) => { renderUser(session?.user || null); });
  client.auth.getSession().then(({ data, error }) => { if (!error) renderUser(data.session?.user || null); }).catch(() => {});
} else {
  const notice = find('[data-auth-notice]');
  notice.textContent = '邮箱登录正在准备中，暂时无法发送验证码。';
  notice.hidden = false;
}
updateButtons();
