            // Local and signed-in workspaces never share a cache or a pending save.
            const LOCAL_STORAGE_KEY = 'garena_filter_v4_local';
            const MODE_STORAGE_KEY = 'garena_filter_v4_mode';
            let authEpoch = 0, pendingCloudSave = null, cloudWriteRunning = false;
            let explicitAuthAction = false, authSubscription = null;
            const safeStorageGet = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
            const safeStorageSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } };
            function isLocalMode() { return currentUser?.id === 'local-workspace'; }
            function cancelPendingSave() {
                clearTimeout(cloudSaveTimer);
                cloudSaveTimer = null;
                pendingCloudSave = null;
            }
            function autosaveEnabled() { return $('autoSave')?.checked !== false; }
            function cloudSyncEnabled() { return $('settingsCloudSync')?.checked !== false; }
            function clearAuthWorkspace() {
                cancelPendingSave();
                if (typeof clearWorkspace === 'function') clearWorkspace();
                else {
                    accounts = []; sets = Object.create(null); selected.clear(); page = 1;
                    ['rawData', 'parserInput', 'authPassword', 'totpSecret', 'newAccountPassword', 'confirmAccountPassword'].forEach(id => { if ($(id)) $(id).value = ''; });
                    render();
                }
                $('authPassword').value = '';
            }
            let cloudWriteTask = null;
            function flushCloudSave() {
                if (cloudWriteRunning) return cloudWriteTask;
                if (!pendingCloudSave) return Promise.resolve();
                cloudWriteRunning = true;
                cloudWriteTask = Promise.resolve().then(async () => {
                    try {
                        while (pendingCloudSave) {
                            const job = pendingCloudSave;
                            pendingCloudSave = null;
                            if (job.epoch !== authEpoch || currentUser?.id !== job.userId || !authReady || isLocalMode() || (!job.force && !autosaveEnabled()) || !cloudSyncEnabled()) continue;
                            try {
                                const { error } = await authTimeout(supabaseClient.from('user_data').upsert({ user_id: job.userId, payload: job.payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }), 10000);
                                if (error) throw error;
                                if (job.epoch === authEpoch && currentUser?.id === job.userId) setCloudStatus(pendingCloudSave ? 'Đang đồng bộ…' : 'Đã đồng bộ');
                            } catch (error) {
                                if (job.epoch === authEpoch && currentUser?.id === job.userId) {
                                    setCloudStatus('Chưa đồng bộ · đã giữ bản trên máy');
                                    toast('Chưa lưu được lên đám mây: ' + (error.message || 'Kiểm tra kết nối và cấu hình dữ liệu.'));
                                }
                            }
                        }
                    } finally { cloudWriteRunning = false; cloudWriteTask = null; }
                });
                return cloudWriteTask;
            }
            function persist(force = false) {
                if (!currentUser) return false;
                if (!force && !autosaveEnabled()) {
                    cancelPendingSave();
                    setCloudStatus('Tự lưu đang tắt');
                    return false;
                }
                const payload = JSON.parse(JSON.stringify({ accounts, sets }));
                const cached = safeStorageSet(STORAGE, JSON.stringify(payload));
                if (!cached) toast('Không thể lưu trên máy: bộ nhớ đầy hoặc trình duyệt đang chặn lưu trữ. Hãy tải bản sao lưu JSON.');
                if (isLocalMode()) {
                    setCloudStatus(cached ? 'Đã lưu trên máy' : 'Chưa lưu được trên máy');
                    return cached;
                }
                if (supabaseClient && authReady && cloudSyncEnabled()) {
                    clearTimeout(cloudSaveTimer);
                    pendingCloudSave = { userId: currentUser.id, epoch: authEpoch, payload, force: Boolean(force) };
                    setCloudStatus('Đang chờ đồng bộ…');
                    cloudSaveTimer = setTimeout(flushCloudSave, 650);
                } else setCloudStatus(cached ? 'Đã lưu trên máy' : 'Chưa lưu dữ liệu');
                return cached;
            }
            function getSets() {
                try { const raw = safeStorageGet(STORAGE); return raw ? validatePayload(JSON.parse(raw)).sets : Object.create(null); }
                catch (_) { return Object.create(null); }
            }
            function loadStored() {
                const raw = safeStorageGet(STORAGE);
                if (!raw) return false;
                try {
                    const payload = validatePayload(JSON.parse(raw));
                    accounts = payload.accounts; sets = payload.sets;
                    return true;
                } catch (_) { toast('Bản lưu trên máy không hợp lệ. Dữ liệu gốc vẫn được giữ; bạn có thể khôi phục từ JSON.'); return false; }
            }
            function setCloudStatus(text) {
                const el = $('cloudStatus');
                if (el) {
                    el.textContent = text;
                    el.title = isLocalMode() ? 'Dữ liệu chỉ được lưu trong trình duyệt này.' : 'Trạng thái lưu dữ liệu của tài khoản hiện tại.';
                    el.dataset.mode = isLocalMode() ? 'local' : 'cloud';
                }
            }
            function showAuthMessage(text, bad = true) {
                $('authMessage').textContent = text || '';
                $('authMessage').style.color = bad ? '#b91c1c' : '#047857';
            }
            function setAuthMode(mode) {
                authMode = mode;
                $('loginTab').classList.toggle('active', mode === 'login');
                $('signupTab').classList.toggle('active', mode === 'signup');
                $('loginTab').setAttribute('aria-selected', String(mode === 'login'));
                $('signupTab').setAttribute('aria-selected', String(mode === 'signup'));
                $('authSubmit').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
                $('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
                $('authPassword').minLength = mode === 'login' ? 1 : 8;
                $('forgotPasswordBtn').style.display = mode === 'login' ? 'block' : 'none';
                showAuthMessage('');
            }
            function showAuthScreen() {
                $('mainApp').classList.add('hidden');
                $('authScreen').classList.remove('hidden');
                setMobileMenu(false);
            }
            function showWorkspace(user) {
                $('userEmail').textContent = isLocalMode() ? 'Trên máy này' : (user.email || 'Tài khoản');
                $('logoutBtn').textContent = isLocalMode() ? 'Đăng nhập' : 'Đăng xuất';
                $('authScreen').classList.add('hidden');
                $('mainApp').classList.remove('hidden');
                updateAccountInfo();
                if (isLocalMode()) {
                    if ($('accountEmailReadOnly')) $('accountEmailReadOnly').value = 'Chế độ trên máy · không có tài khoản đám mây';
                    if ($('accountUserId')) $('accountUserId').value = 'Dữ liệu riêng của trình duyệt này';
                }
                render();
            }
            function enterLocalMode() {
                authEpoch++;
                explicitAuthAction = false;
                authReady = false;
                clearAuthWorkspace();
                currentUser = { id: 'local-workspace', email: '' };
                STORAGE = LOCAL_STORAGE_KEY;
                safeStorageSet(MODE_STORAGE_KEY, 'local');
                const loaded = loadStored();
                showWorkspace(currentUser);
                showPage('dashboard');
                setCloudStatus(!autosaveEnabled() ? 'Tự lưu đang tắt' : loaded ? 'Đã tải bản lưu trên máy' : 'Chế độ trên máy');
                return true;
            }
            function authTimeout(promise, ms = 12000) {
                let timer;
                return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Kết nối quá lâu. Hãy thử lại hoặc chọn Dùng trên máy.')), ms); })]).finally(() => clearTimeout(timer));
            }
            async function enterApp(user) {
                if (!user?.id || !supabaseClient) throw new Error('Phiên đăng nhập không hợp lệ.');
                const epoch = ++authEpoch;
                authReady = false;
                clearAuthWorkspace();
                currentUser = user;
                STORAGE = 'garena_filter_v23_user_' + user.id;
                showAuthMessage('Đang tải dữ liệu của bạn…', false);
                try {
                    const { data, error } = await authTimeout(supabaseClient.from('user_data').select('payload').eq('user_id', user.id).maybeSingle());
                    if (epoch !== authEpoch) return false;
                    if (error) throw error;
                    if (data?.payload) {
                        const payload = validatePayload(data.payload);
                        accounts = payload.accounts; sets = payload.sets;
                        if (autosaveEnabled()) safeStorageSet(STORAGE, JSON.stringify(payload));
                    } else loadStored();
                } catch (error) {
                    if (epoch !== authEpoch) return false;
                    currentUser = null;
                    showAuthScreen();
                    showAuthMessage('Không tải được dữ liệu đám mây. Bạn có thể thử lại hoặc dùng chế độ trên máy. ' + (error.message || ''));
                    return false;
                }
                if (epoch !== authEpoch) return false;
                authReady = true;
                safeStorageSet(MODE_STORAGE_KEY, 'cloud');
                $('authPassword').value = '';
                showWorkspace(user);
                setCloudStatus('Đã tải dữ liệu đám mây');
                return true;
            }
            async function logoutWorkspace() {
                const wasLocal = isLocalMode();
                const hadUser = Boolean(currentUser);
                if (hadUser && autosaveEnabled()) {
                    persist();
                    if (!wasLocal) {
                        const epoch = authEpoch;
                        $('logoutBtn').disabled = true;
                        try { await authTimeout(flushCloudSave(), 11000); }
                        catch (_) { /* The local cache retains unsynced changes. */ }
                        finally { $('logoutBtn').disabled = false; }
                        if (epoch !== authEpoch) return;
                    }
                }
                authEpoch++;
                authReady = false;
                clearAuthWorkspace();
                currentUser = null;
                safeStorageSet(MODE_STORAGE_KEY, 'local');
                showAuthScreen();
                setAuthMode('login');
                setCloudStatus('');
                if (!wasLocal && supabaseClient) {
                    try {
                        const { error } = await authTimeout(supabaseClient.auth.signOut(), 8000);
                        if (error) throw error;
                        showAuthMessage('Đã đăng xuất.', false);
                    } catch (error) { showAuthMessage('Đã đóng dữ liệu trên máy; chưa thể kết thúc phiên đám mây. ' + (error.message || '')); }
                } else showAuthMessage('Đăng nhập để sử dụng dữ liệu đám mây, hoặc tiếp tục dùng trên máy.', false);
            }
            async function revealRecovery(user) {
                if (!await enterApp(user)) return;
                showPage('settings');
                document.querySelector('[data-settings-pane="password"]')?.click();
                $('newAccountPassword')?.focus();
                toast('Đã xác minh liên kết. Hãy nhập mật khẩu mới.');
            }
            function attachAuthObserver() {
                if (authSubscription) return;
                if (supabaseClient) {
                    authSubscription = supabaseClient.auth.onAuthStateChange((event, session) => {
                        // Supabase callbacks must finish before performing another auth operation.
                        if (event === 'PASSWORD_RECOVERY' && session?.user) setTimeout(() => revealRecovery(session.user).catch(error => showAuthMessage(error.message)), 0);
                        else if (event === 'SIGNED_OUT' && !isLocalMode() && currentUser) {
                            authEpoch++; authReady = false; clearAuthWorkspace(); currentUser = null;
                            showAuthScreen(); showAuthMessage('Phiên đăng nhập đã kết thúc.');
                        } else if (event === 'USER_UPDATED' && session?.user && currentUser?.id === session.user.id) {
                            currentUser = session.user; updateAccountInfo();
                        } else if (event === 'SIGNED_IN' && session?.user && !explicitAuthAction && currentUser && !isLocalMode() && currentUser.id !== session.user.id) {
                            setTimeout(() => enterApp(session.user).catch(error => showAuthMessage(error.message)), 0);
                        }
                    });
                }
            }
            async function ensureAuthClient() {
                if(supabaseClient) {attachAuthObserver();return supabaseClient;}
                if(SUPABASE_URL.includes('YOUR-PROJECT')||SUPABASE_ANON_KEY.includes('YOUR_SUPABASE'))throw Error('Chưa cấu hình dịch vụ đám mây.');
                await window.GFPLoadSDK('supabase');
                if(!supabaseClient)supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
                attachAuthObserver();$('authConfig').style.display='none';return supabaseClient;
            }
            async function initAuth() {
                $('loginTab').onclick = () => setAuthMode('login');
                $('signupTab').onclick = () => setAuthMode('signup');
                $('localModeBtn')?.addEventListener('click', enterLocalMode);
                $('logoutBtn').onclick = logoutWorkspace;
                const configured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
                try {
                    if (configured && window.supabase?.createClient) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
                } catch (_) { supabaseClient = null; }
                if (!supabaseClient) {
                    $('authConfig').style.display = 'block';
                    $('authConfig').textContent = 'Dịch vụ đám mây được tải khi bạn đăng nhập. Cần có kết nối Internet.';
                }
                $('authForm').addEventListener('submit', async event => {
                    event.preventDefault();
                    if ($('authSubmit').disabled) return;
                    const actionEpoch = authEpoch;
                    const email = $('authEmail').value.trim(), password = $('authPassword').value;
                    $('authSubmit').disabled = true;
                    explicitAuthAction = true;
                    showAuthMessage('Đang xử lý…', false);
                    const signup = authMode === 'signup';
                    try {
                        await ensureAuthClient();
                        if (actionEpoch !== authEpoch) return;
                        const result = await authTimeout(signup ? supabaseClient.auth.signUp({ email, password }) : supabaseClient.auth.signInWithPassword({ email, password }));
                        if (actionEpoch !== authEpoch) return;
                        const { data, error } = result;
                        if (error) throw error;
                        if (signup && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) showAuthMessage('Email này có thể đã đăng ký. Hãy đăng nhập hoặc chọn Quên mật khẩu.');
                        else if (data.session?.user || (!signup && data.user)) {
                            const entered = await enterApp(data.session?.user || data.user);
                            if (entered) { try { recordLoginHistory(); } catch (_) { /* Storage may be disabled. */ } }
                        } else showAuthMessage('Kiểm tra email để xác nhận tài khoản, sau đó quay lại đăng nhập.', false);
                    } catch (error) { if (actionEpoch === authEpoch) showAuthMessage(error.message || 'Không thể xác thực.'); }
                    finally { explicitAuthAction = false; $('authSubmit').disabled = false; }
                });
                $('forgotPasswordBtn').onclick = async () => {
                    const email = $('authEmail').value.trim();
                    if (!email || !$('authEmail').checkValidity()) { showAuthMessage('Nhập email hợp lệ trước khi khôi phục mật khẩu.'); $('authEmail').focus(); return; }
                    if (!/^https?:$/.test(location.protocol)) { showAuthMessage('Khôi phục mật khẩu cần mở ứng dụng tại địa chỉ HTTP/HTTPS đã cấu hình trong Supabase.'); return; }
                    const button = $('forgotPasswordBtn'), epoch = authEpoch;
                    button.disabled = true;
                    showAuthMessage('Đang gửi email khôi phục…', false);
                    try {
                        await ensureAuthClient();
                        if (epoch !== authEpoch) return;
                        const redirectTo = location.origin + location.pathname;
                        const { error } = await authTimeout(supabaseClient.auth.resetPasswordForEmail(email, { redirectTo }));
                        if (error) throw error;
                        if (epoch === authEpoch) showAuthMessage('Nếu email có tài khoản, bạn sẽ nhận hướng dẫn khôi phục. Hãy kiểm tra cả thư mục Spam.', false);
                    } catch (error) { if (epoch === authEpoch) showAuthMessage(error.message || 'Không gửi được email khôi phục.'); }
                    finally { button.disabled = false; }
                };
                const hasRecovery = /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash) || /[?&]code=/.test(location.search);
                attachAuthObserver();
                const startupEpoch=authEpoch;
                if (!supabaseClient && (safeStorageGet(MODE_STORAGE_KEY)==='cloud'||hasRecovery)) {try {await ensureAuthClient();} catch(error){showAuthMessage(error.message);}}
                if (startupEpoch!==authEpoch) return;
                const tryCloud = supabaseClient && (safeStorageGet(MODE_STORAGE_KEY) === 'cloud' || hasRecovery);
                if (tryCloud) {
                    const epoch = authEpoch;
                    showAuthScreen(); showAuthMessage('Đang khôi phục phiên đăng nhập…', false);
                    try {
                        const { data, error } = await authTimeout(supabaseClient.auth.getSession(), 6000);
                        if (epoch !== authEpoch) return;
                        if (error) throw error;
                        if (data.session?.user) {
                            if (hasRecovery) await revealRecovery(data.session.user);
                            else await enterApp(data.session.user);
                            return;
                        }
                    } catch (error) { if (epoch === authEpoch) showAuthMessage(error.message); }
                    if (epoch !== authEpoch) return;
                }
                enterLocalMode();
            }
