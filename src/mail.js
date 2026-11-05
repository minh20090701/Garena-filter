/* Microsoft Graph mail stays separate from account datasets and backups. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const scopes = ['Mail.Read'];
const clientKey = 'gfp_ms_graph_client_id';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = 'https://graph.microsoft.com/v1.0';
let app = null, appPromise = null, configuredId = '', activeAccount = null;
let mailbox = [], nextLink = null, selectedMail = '', loading = false, connecting = false;
let generation = 0, detailVersion = 0;
const requests = new Set();
const redirectUri = () => /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
const accountId = a => a?.homeAccountId || a?.localAccountId || a?.username || '';
const setText = (id, text) => { if ($(id)) $(id).textContent = text; };
const make = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = String(text); return n; };
const stale = () => Object.assign(new Error('Phiên Microsoft đã thay đổi.'), { stale: true });
const isStale = e => e?.stale || e?.name === 'AbortError';
function assertGeneration(version) { if (version !== generation) throw stale(); }
function notice(message, error = false) {
  setText('msMailNotice', message); setText('msOtpNotice', message);
  for (const id of ['msMailNotice', 'msOtpNotice']) if ($(id)) $(id).style.color = error ? 'var(--danger, #b42338)' : '';
}
function updateButtons() {
  for (const id of ['msConnect', 'msOtpConnect']) $(id).disabled = connecting;
  for (const id of ['msRefresh', 'msOtpRefresh']) $(id).disabled = loading || connecting;
  $('msMoreMail').disabled = loading || connecting || !nextLink;
  $('msMailList').setAttribute('aria-busy', String(loading));
}
function status() {
  const label = activeAccount ? (activeAccount.username || activeAccount.name || 'Đã kết nối') : 'Chưa kết nối';
  for (const id of ['msMailStatus', 'msOtpStatus']) { const n = $(id); n.textContent = label; n.classList.toggle('online', !!activeAccount); }
  updateButtons();
}
function getId() { return $('msClientId').value.trim().toLowerCase(); }
function validateId() {
  const id = getId();
  if (!guid.test(id)) throw Error('Client ID không hợp lệ. Nhập Application (client) ID từ Microsoft Entra.');
  return id;
}
function clearMail() {
  mailbox = []; nextLink = null; selectedMail = ''; detailVersion++;
  renderInbox(); renderOtp();
}
function resetConnection() {
  generation++; detailVersion++;
  for (const controller of requests) controller.abort();
  requests.clear(); app = null; appPromise = null; configuredId = ''; activeAccount = null;
  loading = false; connecting = false; clearMail(); status();
}
async function getApp() {
  if (location.protocol !== 'https:' && !(location.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) {
    throw Error('Microsoft yêu cầu HTTPS hoặc localhost. Các công cụ xử lý dữ liệu vẫn dùng được khi mở file HTML trực tiếp.');
  }
  const id = validateId();
  if (!window.msal?.PublicClientApplication) {
    if (!window.GFPLoadSDK) throw Error('Chưa tải được thư viện Microsoft. Kiểm tra kết nối mạng.');
    await window.GFPLoadSDK('microsoft');
  }
  if (configuredId && configuredId !== id) resetConnection();
  if (app && configuredId === id) return app;
  if (appPromise && configuredId === id) return appPromise;
  configuredId = id;
  const version = generation;
  const promise = (async () => {
    const client = new window.msal.PublicClientApplication({
      auth: { clientId: id, authority: 'https://login.microsoftonline.com/common', redirectUri: redirectUri(), postLogoutRedirectUri: redirectUri(), navigateToLoginRequestUrl: false },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
      system: { loggerOptions: { piiLoggingEnabled: false } }
    });
    if (typeof client.initialize === 'function') await client.initialize();
    const response = await client.handleRedirectPromise();
    assertGeneration(version);
    if (getId() !== id) throw stale();
    const cached = client.getAllAccounts();
    // Ambiguous cached accounts require an explicit account choice.
    activeAccount = response?.account || client.getActiveAccount?.() || (cached.length === 1 ? cached[0] : null);
    if (activeAccount) client.setActiveAccount?.(activeAccount);
    app = client; status();
    return client;
  })();
  appPromise = promise;
  try { return await promise; }
  finally { if (appPromise === promise) appPromise = null; }
}
async function connect() {
  if (connecting) return;
  const version = generation;
  connecting = true; updateButtons();
  try {
    const client = await getApp(); assertGeneration(version);
    if (!activeAccount) {
      try {
        const result = await client.loginPopup({ scopes, prompt: 'select_account' });
        assertGeneration(version);
        if (!result.account) throw Error('Microsoft chưa trả về tài khoản đăng nhập.');
        activeAccount = result.account; client.setActiveAccount?.(activeAccount);
      } catch (e) {
        assertGeneration(version);
        // Cancellation and consent refusal must not trigger an unwanted redirect.
        if (/^(popup_window_error|empty_window_error|popup_window_blocked)$/.test(e.errorCode || '')) {
          notice('Cửa sổ đăng nhập bị chặn. Đang mở trang Microsoft…');
          await client.loginRedirect({ scopes, prompt: 'select_account' });
          return;
        }
        throw e;
      }
    }
    status(); notice('Đã kết nối ' + (activeAccount.username || 'Microsoft') + '. Đang tải thư…');
    await refresh();
  } catch (e) { if (!isStale(e) && version === generation) notice('Đăng nhập không thành công: ' + (e.message || String(e)), true); }
  finally { if (version === generation) { connecting = false; updateButtons(); } }
}
async function token(version) {
  const client = await getApp(); assertGeneration(version);
  const account = activeAccount;
  if (!account) throw Error('Hãy đăng nhập Microsoft trước.');
  let result;
  try { result = await client.acquireTokenSilent({ account, scopes }); }
  catch (e) {
    assertGeneration(version);
    const interactionRequired = window.msal.InteractionRequiredAuthError;
    if ((interactionRequired && e instanceof interactionRequired) || /interaction_required|consent_required|login_required/i.test(e.errorCode || '')) {
      result = await client.acquireTokenPopup({ account, scopes, loginHint: account.username });
    } else throw e;
  }
  assertGeneration(version);
  if (accountId(activeAccount) !== accountId(account) || (result.account && accountId(result.account) !== accountId(account))) {
    resetConnection(); notice('Phiên Microsoft đã đổi tài khoản. Hãy kết nối lại để tải đúng hộp thư.', true); throw stale();
  }
  if (!result.accessToken) throw Error('Microsoft chưa cấp quyền đọc thư. Kiểm tra quyền Mail.Read.');
  return result.accessToken;
}
async function graph(path) {
  const version = generation;
  const url = new URL(path.startsWith('/') ? base + path : path);
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/me/') || url.username || url.password || url.hash) throw Error('URL Microsoft Graph không hợp lệ.');
  const accessToken = await token(version); assertGeneration(version);
  const controller = new AbortController(); requests.add(controller);
  try {
    const response = await fetch(url.href, { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json', Prefer: 'outlook.body-content-type="text"' }, cache: 'no-store', signal: controller.signal });
    assertGeneration(version);
    const data = await response.json().catch(() => { throw Error('Microsoft Graph trả về dữ liệu không hợp lệ.'); });
    assertGeneration(version);
    if (!response.ok) {
      const hint = response.status === 401 ? 'Phiên đăng nhập hết hạn; hãy ngắt kết nối rồi đăng nhập lại.' : response.status === 403 ? 'Kiểm tra quyền Delegated Mail.Read và sự đồng ý của tài khoản.' : response.status === 429 ? 'Microsoft đang giới hạn yêu cầu. Hãy đợi rồi thử lại.' : (data.error?.message || 'Thử lại sau.');
      throw Error('Microsoft Graph ' + response.status + ' — ' + hint);
    }
    return data;
  } finally { requests.delete(controller); }
}
function safeDate(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString('vi-VN') : ''; }
function validMessages(data) {
  if (!Array.isArray(data.value)) throw Error('Danh sách thư không đúng định dạng.');
  return data.value.filter(m => m && typeof m.id === 'string' && m.id);
}
async function refresh() {
  if (loading) return;
  const version = generation;
  loading = true; updateButtons();
  try {
    if (!activeAccount) await getApp(); assertGeneration(version);
    if (!activeAccount) throw Error('Hãy đăng nhập Microsoft trước.');
    const count = Math.min(100, Math.max(1, Math.floor(Number($('msMailCount').value) || 50)));
    notice('Đang tải thư từ Microsoft Graph…');
    const data = await graph('/me/mailFolders/inbox/messages?$top=' + count + '&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead');
    assertGeneration(version);
    const messages = validMessages(data);
    mailbox = messages; nextLink = data['@odata.nextLink'] || null; selectedMail = ''; detailVersion++;
    renderInbox(); renderOtp();
    notice('Đã tải ' + mailbox.length + ' thư. Chọn email để xem nội dung, hoặc mở trang tìm mã.');
  } catch (e) { if (!isStale(e) && version === generation) notice('Không tải được thư: ' + (e.message || String(e)), true); }
  finally { if (version === generation) { loading = false; updateButtons(); } }
}
async function loadMore() {
  if (loading || !nextLink) return;
  const version = generation;
  loading = true; updateButtons();
  try {
    const data = await graph(nextLink); assertGeneration(version);
    const messages = validMessages(data), found = new Set(mailbox.map(m => m.id));
    for (const message of messages) if (!found.has(message.id)) { mailbox.push(message); found.add(message.id); }
    nextLink = data['@odata.nextLink'] || null;
    renderInbox(); renderOtp(); notice('Đã tải ' + mailbox.length + ' thư.');
  } catch (e) { if (!isStale(e) && version === generation) notice('Không tải thêm được thư: ' + (e.message || String(e)), true); }
  finally { if (version === generation) { loading = false; updateButtons(); } }
}
function renderInbox() {
  const list = $('msMailList'); list.replaceChildren();
  const query = $('msMailSearch').value.trim().toLocaleLowerCase('vi');
  const filtered = mailbox.filter(m => [m.subject, m.from?.emailAddress?.name, m.from?.emailAddress?.address, m.bodyPreview].some(t => String(t || '').toLocaleLowerCase('vi').includes(query)));
  if (!filtered.length) list.append(make('div', 'mail-empty', mailbox.length ? 'Không có thư phù hợp.' : 'Chưa tải thư.'));
  for (const message of filtered) {
    const button = make('button', 'mail-list-item' + (selectedMail === message.id ? ' active' : '')); button.type = 'button';
    button.setAttribute('aria-pressed', String(selectedMail === message.id));
    button.append(make('span', '', message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Người gửi không rõ'), make('strong', '', message.subject || '(Không có tiêu đề)'), make('small', '', safeDate(message.receivedDateTime)));
    button.addEventListener('click', () => showMessage(message.id)); list.append(button);
  }
  updateButtons();
  if (!selectedMail) $('msMailDetail').replaceChildren(make('div', 'mail-empty', 'Chọn một email để xem nội dung.'));
}
function plainBody(detail) {
  const body = String(detail.body?.content || detail.bodyPreview || '');
  if (String(detail.body?.contentType || '').toLowerCase() !== 'html') return body;
  const doc = new DOMParser().parseFromString(body, 'text/html');
  for (const node of doc.querySelectorAll('script,style,noscript')) node.remove();
  for (const node of doc.querySelectorAll('br,p,div,tr,li')) node.append('\n');
  return doc.body?.textContent || '';
}
async function showMessage(id) {
  if (!mailbox.some(m => m.id === id)) return;
  const version = generation, request = ++detailVersion;
  selectedMail = id; renderInbox();
  const pane = $('msMailDetail'); pane.replaceChildren(make('div', 'mail-empty', 'Đang tải nội dung…'));
  try {
    const detail = await graph('/me/messages/' + encodeURIComponent(id) + '?$select=id,subject,from,receivedDateTime,body,bodyPreview');
    if (version !== generation || request !== detailVersion || selectedMail !== id) return;
    const title = make('h3', '', detail.subject || '(Không có tiêu đề)'); title.style.marginTop = '0';
    pane.replaceChildren(title, make('div', 'mail-muted', 'Từ: ' + (detail.from?.emailAddress?.address || 'Không rõ') + ' · ' + safeDate(detail.receivedDateTime)), make('div', 'mail-detail-body', plainBody(detail)));
  } catch (e) { if (!isStale(e) && version === generation && request === detailVersion && selectedMail === id) pane.replaceChildren(make('div', 'mail-empty', 'Không đọc được nội dung: ' + (e.message || e))); }
}
function codeCandidates(text) {
  const output = [];
  // Standalone 4–8 digit suggestions; letters, longer numbers and identifiers do not match.
  for (const match of String(text || '').matchAll(/(?:^|[^\p{L}\p{N}_])([0-9]{4,8})(?=$|[^\p{L}\p{N}_])/gu)) {
    if (!output.includes(match[1])) output.push(match[1]);
    if (output.length === 3) break;
  }
  return output;
}
function renderOtp() {
  const root = $('msOtpResults'); root.replaceChildren();
  const query = $('msOtpSearch').value.trim().toLocaleLowerCase('vi');
  const days = Math.max(0, Number($('msOtpTime').value) || 0), cutoff = days ? Date.now() - days * 86400000 : 0;
  const results = mailbox.filter(m => {
    const text = [m.subject, m.bodyPreview, m.from?.emailAddress?.name, m.from?.emailAddress?.address].join(' ').toLocaleLowerCase('vi');
    if (query && !text.includes(query)) return false;
    const received = new Date(m.receivedDateTime).getTime();
    if (cutoff && (!Number.isFinite(received) || received < cutoff)) return false;
    return /verification|security code|one.time|\botp\b|mã xác|xác minh|mã bảo mật|sign.in code|đăng nhập|confirm|authenticate/i.test(text) || !!query;
  });
  if (!results.length) { root.append(make('div', 'mail-empty', mailbox.length ? 'Không thấy thư phù hợp trong những thư đã tải.' : 'Hãy kết nối và tải thư Microsoft trước.')); return; }
  for (const message of results) {
    const card = make('div', 'mail-code-card');
    card.append(make('div', 'mail-muted', (message.subject || '(Không có tiêu đề)') + ' · ' + safeDate(message.receivedDateTime)), make('small', '', message.from?.emailAddress?.address || ''));
    const codes = codeCandidates((message.subject || '') + '\n' + (message.bodyPreview || ''));
    if (codes.length) {
      card.append(make('strong', '', codes.join(' / ')));
      const button = make('button', 'btn', 'Sao chép mã đầu tiên'); button.type = 'button'; button.addEventListener('click', () => copy(codes[0])); card.append(button);
    } else {
      const hint = make('p', 'mail-muted', 'Chưa thấy mã trong phần xem trước.'); card.append(hint);
      const scan = make('button', 'btn', 'Tìm mã trong thư đầy đủ'); scan.type = 'button';
      scan.addEventListener('click', async () => {
        const version = generation;
        scan.disabled = true; scan.textContent = 'Đang kiểm tra…';
        try {
          const detail = await graph('/me/messages/' + encodeURIComponent(message.id) + '?$select=subject,body,bodyPreview');
          if (version !== generation || !root.contains(card)) return;
          const matches = codeCandidates((detail.subject || '') + '\n' + plainBody(detail));
          hint.textContent = matches.length ? 'Mã gợi ý: ' + matches.join(' / ') : 'Không thấy mã dạng 4–8 chữ số trong thư.';
          if (matches.length) { const button = make('button', 'btn', 'Sao chép mã đầu tiên'); button.type = 'button'; button.addEventListener('click', () => copy(matches[0])); scan.replaceWith(button); }
          else { scan.textContent = 'Thử lại'; scan.disabled = false; }
        } catch (e) { if (!isStale(e) && version === generation && root.contains(card)) { hint.textContent = 'Lỗi đọc thư: ' + (e.message || e); scan.textContent = 'Thử lại'; scan.disabled = false; } }
      }); card.append(scan);
    }
    const full = make('button', 'btn', 'Xem thư'); full.type = 'button'; full.style.marginLeft = '8px';
    full.addEventListener('click', () => { document.querySelector('[data-page="tool-outlook"]')?.click(); showMessage(message.id); });
    card.append(full); root.append(card);
  }
}
async function copy(value) {
  if (!value) { notice('Chưa có URI hợp lệ. Mở trang qua HTTPS hoặc localhost trước.', true); return; }
  try {
    if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
    await navigator.clipboard.writeText(value); notice('Đã sao chép.');
  } catch (_) {
    const previous = document.activeElement, area = make('textarea', '', value); area.value = value;
    area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
    try { if (!document.execCommand('copy')) throw Error(); notice('Đã sao chép.'); }
    catch (_) { notice('Không sao chép được. Hãy chọn và sao chép nội dung trực tiếp.', true); }
    finally { area.remove(); previous?.focus?.(); }
  }
}
async function signOut() {
  const client = app, account = activeAccount;
  resetConnection(); const version = generation;
  notice('Đã xóa thư và ngắt kết nối trên trang này.');
  try {
    if (client && account) await client.logoutPopup({ account, mainWindowRedirectUri: redirectUri() });
  } catch (e) { if (version === generation) notice('Đã xóa thư trên trang. Phiên Microsoft chưa đăng xuất hoàn toàn: ' + (e.message || e), true); }
}
function initialize() {
  $('msRedirectUri').value = redirectUri() || 'Mở trang qua HTTPS hoặc localhost để lấy Redirect URI';
  try { const value = localStorage.getItem(clientKey) || ''; $('msClientId').value = guid.test(value) ? value : ''; } catch (_) { notice('Trình duyệt không cho lưu Client ID; bạn vẫn có thể nhập và kết nối.', true); }
  $('msClientId').addEventListener('input', () => {
    if (getId() !== configuredId) { resetConnection(); notice('Client ID đã thay đổi. Bấm Đăng nhập Microsoft để kết nối.'); }
  });
  $('msClientId').addEventListener('change', () => {
    const value = getId();
    try { if (guid.test(value)) localStorage.setItem(clientKey, value); else localStorage.removeItem(clientKey); }
    catch (_) { notice('Không lưu được Client ID trên trình duyệt này; thông tin chỉ dùng trong phiên hiện tại.', true); }
  });
  $('msCopyRedirect').onclick = () => copy(redirectUri());
  $('msConnect').onclick = connect; $('msOtpConnect').onclick = connect;
  $('msRefresh').onclick = refresh; $('msOtpRefresh').onclick = refresh;
  $('msSignOut').onclick = signOut; $('msMoreMail').onclick = loadMore;
  $('msMailSearch').addEventListener('input', renderInbox);
  $('msOtpSearch').addEventListener('input', renderOtp); $('msOtpTime').addEventListener('change', renderOtp);
  $('msOpenOtp').onclick = () => document.querySelector('[data-page="tool-mail-code"]')?.click();
  $('msOtpConfig').onclick = () => document.querySelector('[data-page="tool-outlook"]')?.click();
  $('logoutBtn')?.addEventListener('click', () => { resetConnection(); notice('Đã xóa thư và phiên kết nối khỏi giao diện.'); });
  document.addEventListener('gfp-workspace-cleared', resetConnection);
  if (getId() && (window.msal || /(?:code|id_token)=/.test(location.hash))) getApp().then(() => { if (activeAccount) notice('Đã phát hiện phiên Microsoft. Bấm Tải thư để đọc.'); }).catch(e => { if (!isStale(e)) notice('Microsoft chưa sẵn sàng: ' + (e.message || e), true); });
  status();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
})();
