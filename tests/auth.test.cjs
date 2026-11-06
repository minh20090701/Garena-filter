'use strict';
// Isolated authentication/storage regression tests. All SDK calls are mocked;
// this suite cannot reach Supabase or perform real account operations.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const sourcePath = path.join(__dirname, '..', 'src', 'auth.js');
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const row = tk => ({ id: tk, tk, mk: 'test-only', lv: 0 });
const user = id => ({ id, email: `${id}@example.test` });

function harness(t, options = {}) {
    const elements = new Map(), timers = new Set();
    // Existing regression tests simulate a user who previously selected local mode.
    // Pass freshOrigin=true to simulate opening the configured app on a new host.
    const storage = new Map(options.storage || []);
    if (!options.freshOrigin && !storage.has('garena_filter_v4_mode')) storage.set('garena_filter_v4_mode', 'local');
    const calls = { loads: [], writes: [], signins: [], signups: [], signouts: [], sdkLoads: [], pages: [], toasts: [], resets: [], history: 0 };
    const controls = { load: () => Promise.resolve({ data: { payload: { accounts: [], sets: {} } }, error: null }), write: () => Promise.resolve({ error: null }), signin: () => Promise.resolve({ data: { user: user('alice'), session: { user: user('alice') } }, error: null }), signout: () => Promise.resolve({ error: null }), session: null, loader: () => Promise.resolve() };
    let authListener;
    const el = id => {
        if (!elements.has(id)) {
            const classes = new Set(id === 'mainApp' ? ['hidden'] : []), listeners = new Map();
            elements.set(id, {
                id, value: '', checked: true, disabled: false, style: {}, dataset: {}, textContent: '', focused: false,
                classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle(n, force) { const on = force === undefined ? !classes.has(n) : force; on ? classes.add(n) : classes.delete(n); return on; } },
                addEventListener(name, listener) { listeners.set(name, listener); }, setAttribute(name, value) { this[name] = value; },
                checkValidity: () => true, focus() { this.focused = true; },
                click() { if (this.disabled) return; const event = { preventDefault() {} }; return this.onclick ? this.onclick(event) : listeners.get('click')?.(event); },
                fire(name) { return listeners.get(name)?.({ preventDefault() {} }); }
            });
        }
        return elements.get(id);
    };
    const client = {
        from(table) {
            assert.equal(table, 'user_data');
            return {
                select(column) { assert.equal(column, 'payload'); return { eq(field, id) { assert.equal(field, 'user_id'); return { maybeSingle() { calls.loads.push(id); return controls.load(id); } }; } }; },
                upsert(value, config) { assert.equal(config.onConflict, 'user_id'); calls.writes.push(JSON.parse(JSON.stringify(value))); return controls.write(value); }
            };
        },
        auth: {
            onAuthStateChange(listener) { authListener = listener; return { data: { subscription: { unsubscribe() { authListener = null; } } } }; },
            getSession: async () => ({ data: { session: controls.session }, error: null }),
            signInWithPassword(credentials) { calls.signins.push({ ...credentials }); return controls.signin(credentials); },
            signUp(credentials) { calls.signups.push({ ...credentials }); return controls.signin(credentials); },
            signOut() { calls.signouts.push(true); return controls.signout(); },
            resetPasswordForEmail(email, config) { calls.resets.push({ email, ...config }); return Promise.resolve({ error: null }); }
        }
    };
    const window = {};
    const installSDK = () => { window.supabase = { createClient: () => client }; };
    if (options.preloaded) installSDK();
    window.GFPLoadSDK = async name => { calls.sdkLoads.push(name); await controls.loader(name); installSDK(); };
    const ctx = {
        console, window, location: { protocol: 'http:', origin: 'http://localhost', pathname: '/app.html', hash: options.hash || '', search: options.search || '' },
        setTimeout(callback, ms) { const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms); timers.add(timer); return timer; },
        clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); },
        $: el,
        document: { querySelector(selector) { return selector === '[data-settings-pane="password"]' ? el('passwordPane') : null; } },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { if (options.storageBlocked) throw new Error('Storage denied'); storage.set(key, value); } },
        SUPABASE_URL: 'https://mock.example.test', SUPABASE_ANON_KEY: 'test-public-key',
        isSupabaseConfigured: () => true,
        supabaseClient: null, currentUser: null, authReady: false, authMode: 'login', cloudSaveTimer: null, STORAGE: '',
        accounts: [], sets: {}, selected: new Set(), page: 1,
        validatePayload(payload) { if (!Array.isArray(payload?.accounts) || !payload.accounts.every(a => a && typeof a.tk === 'string')) throw new Error('Invalid payload'); return { accounts: payload.accounts, sets: payload.sets || {} }; },
        toast: message => calls.toasts.push(message), render() {}, setMobileMenu() {}, updateAccountInfo() {},
        showPage: name => calls.pages.push(name), recordLoginHistory() { calls.history++; }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), ctx, { filename: sourcePath });
    const run = code => vm.runInContext(code, ctx);
    t.after(() => { run('cancelPendingSave()'); for (const timer of timers) clearTimeout(timer); });
    return { ctx, el, calls, controls, storage, client, run, emit(event, session) { authListener?.(event, session); }, installSDK, async init() { await run('initAuth()'); }, async enter(id = 'alice') { ctx.supabaseClient = client; return run(`enterApp(${JSON.stringify(user(id))})`); } };
}

test('startup enters local workspace without loading an SDK or calling auth', async t => {
    const h = harness(t);
    await h.init();
    assert.equal(h.ctx.currentUser.id, 'local-workspace');
    assert.equal(h.ctx.STORAGE, 'garena_filter_v4_local');
    assert.equal(h.el('mainApp').classList.contains('hidden'), false);
    assert.deepEqual(h.calls.sdkLoads, []);
    assert.deepEqual(h.calls.loads, []);
    assert.deepEqual(h.calls.signins, []);
    assert.equal(h.el('localModeBtn').disabled, false);
});

test('configured cloud opens login first on a new GitHub Pages or Netlify origin', async t => {
    const h = harness(t, { freshOrigin: true });
    await h.init();
    assert.equal(h.ctx.currentUser, null);
    assert.equal(h.el('mainApp').classList.contains('hidden'), true);
    assert.equal(h.el('authScreen').classList.contains('hidden'), false);
    assert.equal(h.el('localModeBtn').disabled, false);
    assert.deepEqual(h.calls.signins, []);
    h.el('localModeBtn').click();
    assert.equal(h.ctx.currentUser.id, 'local-workspace');
});

test('persist(false) respects autosave; persist(true) saves an explicit snapshot', async t => {
    const h = harness(t); await h.init();
    h.ctx.accounts = [row('original')]; assert.equal(h.run('persist(false)'), true);
    h.el('autoSave').checked = false;
    h.ctx.accounts = [row('changed')]; assert.equal(h.run('persist(false)'), false);
    assert.equal(JSON.parse(h.storage.get('garena_filter_v4_local')).accounts[0].tk, 'original');
    assert.equal(h.run('persist(true)'), true);
    h.ctx.accounts[0].tk = 'later-memory-change';
    assert.equal(JSON.parse(h.storage.get('garena_filter_v4_local')).accounts[0].tk, 'changed');
    assert.deepEqual(h.calls.writes, []);
});

test('malformed cache remains untouched and blocked storage does not break local mode', async t => {
    const broken = '{"accounts":"not-an-array"}';
    const h = harness(t, { storage: [['garena_filter_v4_local', broken]] }); await h.init();
    assert.equal(h.ctx.accounts.length, 0);
    assert.equal(h.storage.get('garena_filter_v4_local'), broken);
    assert.ok(h.calls.toasts.some(message => message.includes('không hợp lệ')));
    const blocked = harness(t, { storageBlocked: true }); await blocked.init();
    blocked.ctx.accounts = [row('memory-only')]; assert.equal(blocked.run('persist()'), false);
    assert.equal(blocked.ctx.accounts.length, 1);
    assert.ok(blocked.calls.toasts.some(message => message.includes('Không thể lưu')));
});

test('cloud saves capture user ownership and cannot execute after a user switch', async t => {
    const h = harness(t); await h.enter('alice');
    h.ctx.accounts = [row('alice-private')]; h.run('persist()');
    await h.enter('bob');
    await h.run('flushCloudSave()');
    assert.equal(h.calls.writes.length, 0);
    h.ctx.accounts = [row('bob-private')]; h.run('persist()'); await h.run('flushCloudSave()');
    assert.equal(h.calls.writes.length, 1);
    assert.equal(h.calls.writes[0].user_id, 'bob');
    assert.equal(h.calls.writes[0].payload.accounts[0].tk, 'bob-private');
    assert.equal(JSON.parse(h.storage.get('garena_filter_v23_user_alice')).accounts[0].tk, 'alice-private');
});

test('cloud writes serialize snapshots and preserve a newer pending change', async t => {
    const h = harness(t); await h.enter();
    const first = deferred(); let index = 0;
    h.controls.write = () => index++ === 0 ? first.promise : Promise.resolve({ error: null });
    h.ctx.accounts = [row('first')]; h.run('persist()'); const flush = h.run('flushCloudSave()');
    await tick();
    h.ctx.accounts = [row('second')]; h.run('persist()'); const secondFlush = h.run('flushCloudSave()');
    assert.equal(h.calls.writes.length, 1);
    first.resolve({ error: null }); await Promise.all([flush, secondFlush]);
    assert.equal(h.calls.writes.length, 2);
    assert.equal(h.calls.writes[1].payload.accounts[0].tk, 'second');
});

test('late cloud loads cannot overwrite a newly selected local workspace', async t => {
    const h = harness(t); const load = deferred(); h.controls.load = () => load.promise;
    const entering = h.enter('alice'); h.run('enterLocalMode()');
    load.resolve({ data: { payload: { accounts: [row('cloud-secret')], sets: {} } }, error: null });
    assert.equal(await entering, false);
    assert.equal(h.ctx.currentUser.id, 'local-workspace');
    assert.equal(h.ctx.accounts.length, 0);
    assert.equal(h.ctx.STORAGE, 'garena_filter_v4_local');
});

test('logout flushes the latest cloud change before signing out and clears visible data', async t => {
    const h = harness(t); await h.enter('alice');
    h.ctx.accounts = [row('latest')]; h.run('persist()');
    h.el('rawData').value = 'private-input'; h.el('authPassword').value = 'private-password';
    h.controls.signout = async () => {
        assert.equal(h.calls.writes.length, 1, 'latest data must be saved before signOut');
        assert.equal(h.calls.writes[0].payload.accounts[0].tk, 'latest');
        return { error: null };
    };
    await h.run('logoutWorkspace()');
    assert.equal(h.calls.signouts.length, 1);
    assert.equal(h.ctx.currentUser, null); assert.equal(h.ctx.accounts.length, 0);
    assert.equal(h.el('rawData').value, ''); assert.equal(h.el('authPassword').value, '');
    assert.equal(h.el('mainApp').classList.contains('hidden'), true);
    assert.equal(h.el('authScreen').classList.contains('hidden'), false);
});

test('external signout clears cloud data but does not interrupt local mode', async t => {
    const h = harness(t, { preloaded: true }); await h.init(); await h.enter('alice');
    h.ctx.accounts = [row('private')]; h.emit('SIGNED_OUT', null);
    assert.equal(h.ctx.currentUser, null); assert.equal(h.ctx.accounts.length, 0);
    h.run('enterLocalMode()'); h.ctx.accounts = [row('local')]; h.emit('SIGNED_OUT', null);
    assert.equal(h.ctx.currentUser.id, 'local-workspace'); assert.equal(h.ctx.accounts[0].tk, 'local');
});

test('recovery event opens the password settings pane after loading that user', async t => {
    const h = harness(t, { preloaded: true }); await h.init();
    let opened = false; h.el('passwordPane').onclick = () => { opened = true; };
    h.emit('PASSWORD_RECOVERY', { user: user('recover') });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(h.ctx.currentUser.id, 'recover');
    assert.equal(h.calls.pages.at(-1), 'settings');
    assert.equal(opened, true); assert.equal(h.el('newAccountPassword').focused, true);
});

test('choosing local mode while the login SDK loads cancels the pending login', async t => {
    const h = harness(t); await h.init(); await h.run('logoutWorkspace()');
    const loader = deferred(); h.controls.loader = () => loader.promise;
    h.el('authEmail').value = 'alice@example.test'; h.el('authPassword').value = 'test-password';
    const submitting = h.el('authForm').fire('submit');
    await tick(); h.run('enterLocalMode()'); loader.resolve(); await submitting;
    assert.equal(h.calls.signins.length, 0);
    assert.equal(h.ctx.currentUser.id, 'local-workspace');
});

test('rapid repeated submit makes only one SDK authentication call', async t => {
    const h = harness(t); await h.init(); await h.run('logoutWorkspace()');
    const loader = deferred(); h.controls.loader = () => loader.promise;
    h.el('authEmail').value = 'alice@example.test'; h.el('authPassword').value = 'test-password';
    const first = h.el('authForm').fire('submit'); const second = h.el('authForm').fire('submit');
    loader.resolve(); await Promise.all([first, second]);
    assert.equal(h.calls.signins.length, 1);
    assert.equal(h.ctx.currentUser.id, 'alice');
});

test('failed cloud load keeps workspace closed and does not enable saving', async t => {
    const h = harness(t); h.controls.load = async () => ({ data: null, error: new Error('Mock RLS failure') });
    assert.equal(await h.enter('alice'), false);
    assert.equal(h.ctx.currentUser, null); assert.equal(h.ctx.authReady, false);
    assert.equal(h.el('mainApp').classList.contains('hidden'), true);
    assert.match(h.el('authMessage').textContent, /Mock RLS failure/);
    h.run('persist()'); assert.equal(h.calls.writes.length, 0);
});

test('logout waits for an in-flight write and its newer snapshot before ending the session', async t => {
    const h = harness(t); await h.enter('alice');
    const firstWrite = deferred(); let n = 0;
    h.controls.write = () => n++ === 0 ? firstWrite.promise : Promise.resolve({ error: null });
    h.ctx.accounts = [row('first')]; h.run('persist()'); const existingFlush = h.run('flushCloudSave()');
    await tick(); h.ctx.accounts = [row('latest-before-logout')];
    const signingOut = h.run('logoutWorkspace()'); await tick();
    assert.equal(h.calls.signouts.length, 0);
    assert.equal(h.el('logoutBtn').disabled, true);
    firstWrite.resolve({ error: null }); await Promise.all([existingFlush, signingOut]);
    assert.equal(h.calls.writes.length, 2);
    assert.equal(h.calls.writes[1].payload.accounts[0].tk, 'latest-before-logout');
    assert.equal(h.calls.signouts.length, 1); assert.equal(h.ctx.currentUser, null);
});

test('local choice during initial SDK/session restoration wins over saved cloud preference', async t => {
    const h = harness(t, { storage: [['garena_filter_v4_mode', 'cloud']] });
    const loader = deferred(); h.controls.loader = () => loader.promise;
    h.controls.session = { user: user('alice') };
    const starting = h.init(); await tick();
    h.run('enterLocalMode()'); loader.resolve(); await starting;
    assert.equal(h.ctx.currentUser.id, 'local-workspace');
    assert.equal(h.calls.loads.length, 0);
    assert.equal(h.storage.get('garena_filter_v4_mode'), 'local');
});
