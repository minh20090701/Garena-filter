    function bindPanelToggle(buttonId,contentId){
        const button=$(buttonId),content=$(contentId);
        button.onclick=()=>{const hidden=content.classList.toggle('hidden');button.textContent=hidden?'Hiện':'Ẩn';button.setAttribute('aria-expanded',String(!hidden));};
    }
    bindPanelToggle('toggleQuickImport','quickImportContent');bindPanelToggle('togglePasteProcess','pasteProcessContent');
    $('toggleAccountList').onclick=()=>{const hidden=$('accountListContent').classList.toggle('hidden');$('toggleAccountList').textContent=hidden?'Hiện danh sách':'Ẩn danh sách';$('toggleAccountList').setAttribute('aria-expanded',String(!hidden));};
    $('togglePassword').onclick=()=>{showPasswords=!showPasswords;$('togglePassword').textContent=showPasswords?'◉ Ẩn mật khẩu':'◉ Hiện mật khẩu';$('togglePassword').setAttribute('aria-pressed',String(showPasswords));render();};
    function setMobileMenu(open){
        $('sidebar').classList.toggle('open',open);$('sidebarBackdrop').classList.toggle('open',open);
        $('mobileMenu').setAttribute('aria-expanded',String(open));document.body.style.overflow=open&&innerWidth<=760?'hidden':'';
        if(innerWidth<=760)$('sidebar').inert=!open;
        else $('sidebar').inert=false;
        if(open&&innerWidth<=760)$('sidebarClose').focus();
    }
    document.querySelectorAll('.nav[data-page]').forEach(button=>button.addEventListener('click',()=>{showPage(button.dataset.page);if(innerWidth<=760)$('mobileMenu').focus();}));
    $('mobileMenu').onclick=()=>setMobileMenu(!$('sidebar').classList.contains('open'));
    $('sidebarClose').onclick=$('sidebarBackdrop').onclick=()=>{setMobileMenu(false);$('mobileMenu').focus();};
    window.addEventListener('resize',()=>setMobileMenu(false));setMobileMenu(false);
    $('navSearch').addEventListener('input',()=>{
        const q=fieldKey($('navSearch').value);document.querySelectorAll('.nav[data-page]').forEach(b=>b.hidden=!fieldKey(b.textContent).includes(q));
    });
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'){setMobileMenu(false);}
        if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!event.ctrlKey&&!event.metaKey&&$('mainApp').classList.contains('hidden')===false){event.preventDefault();if(innerWidth<=760)setMobileMenu(true);$('navSearch').focus();}
        if(event.key==='Tab'&&innerWidth<=760&&$('sidebar').classList.contains('open')){
            const nodes=[...$('sidebar').querySelectorAll('button,input')].filter(el=>!el.hidden&&el.offsetParent!==null);const first=nodes[0],last=nodes.at(-1);
            if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
    });
    function savePreferences(){safeStorageSet('gfp_v4_preferences',JSON.stringify({dark:document.body.classList.contains('dark'),autosave:$('autoSave').checked,pageSize:$('pageSize').value}));}
    function setTheme(dark){document.body.classList.toggle('dark',dark);$('settingsDark').checked=dark;$('topTheme').setAttribute('aria-pressed',String(dark));savePreferences();}
    $('themeBtn').onclick=$('topTheme').onclick=()=>setTheme(!document.body.classList.contains('dark'));
    $('settingsDark').onchange=e=>setTheme(e.target.checked);
    function changeAutoSave(checked){$('autoSave').checked=$('settingsAutoSave').checked=checked;savePreferences();if(!checked)cancelPendingSave();persist();}
    $('autoSave').onchange=e=>changeAutoSave(e.target.checked);$('settingsAutoSave').onchange=e=>changeAutoSave(e.target.checked);
    try{const preferences=JSON.parse(safeStorageGet('gfp_v4_preferences')||'{}');if(typeof preferences.dark==='boolean')document.body.classList.toggle('dark',preferences.dark);if(typeof preferences.autosave==='boolean')$('autoSave').checked=$('settingsAutoSave').checked=preferences.autosave;if(['10','25','50','100'].includes(preferences.pageSize))$('pageSize').value=preferences.pageSize;}catch(_){}
    $('settingsDark').checked=document.body.classList.contains('dark');
    $('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
    $('helpDialog').onclick=e=>{if(e.target===$('helpDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
    $('processBtn').onclick=()=>importText($('rawData').value,'auto','rawData');
    $('parseBtn').onclick=()=>importText($('parserInput').value,$('delimiter').value,'parserInput');
    $('parserToRaw').onclick=()=>{$('rawData').value=$('parserInput').value;cleanEditor('rawData');showPage('dashboard');toast('Đã chuyển sang ô nhập chính.');};
    $('clearData').onclick=()=>{$('rawData').value='';cleanEditor('rawData');$('parseStatus').textContent='Đã xóa ô nhập';};
    $('demoBtn').onclick=()=>{
        $('rawData').value=[
            'demo01|matkhau-mau|UID: 100001|NAME: Ánh Bình Minh|LEVEL: 30|SKIN: 128|SS: 8|SSS: 3|Status: ACC FULL',
            'demo02|matkhau-mau|UID: 100002|NAME: Mây Trắng|LEVEL: 24|SKIN: 42|MAIL: demo@example.com',
            'demo03|matkhau-mau|UID: 100003|NAME: Gió Mùa|LEVEL: 18|SKIN: 0|Status: ACC TRẮNG',
            'demo04|matkhau-mau|UID: 100004|NAME: Đại Dương|LEVEL: 30|SKIN: 86|PHONE: 0900000000',
            'demo05|matkhau-mau|UID: 100005|NAME: Sao Mai|LEVEL: 1|SKIN: 0|Status: ACC TRẮNG LỖI PASS',
            'demo06|matkhau-mau|UID: 100006|NAME: Lửa Nhỏ|LEVEL: 12|SKIN: 20'
        ].join('\n');cleanEditor('rawData');toast('Đã điền 6 dòng mẫu. Bấm Xử lý dữ liệu để đưa vào bảng.');$('rawData').focus();
    };
    async function readFileInput(input,restoreOnly=false){
        const file=input.files[0];if(!file)return;const owner=currentUser?.id;
        try{
            if(file.size>MAX_FILE_BYTES)throw Error('Tệp vượt quá giới hạn 20 MB.');
            const text=await file.text();if(owner!==currentUser?.id)return;
            if(restoreOnly||file.name.toLowerCase().endsWith('.json')){
                let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch(_){throw Error('File JSON không đúng định dạng. Dữ liệu hiện tại được giữ nguyên.');}
                const payload=validatePayload(data);checkpoint('khôi phục dữ liệu');accounts=payload.accounts;
                if(restoreOnly||data.sets!==undefined)sets=payload.sets;
                selected.clear();page=1;render();persist();toast(`Đã khôi phục ${accounts.length} tài khoản.`);
            }else importText(text);
        }catch(error){toast(error.message||'Không thể đọc tệp.');}finally{input.value='';}
    }
    $('importFile').onchange=e=>readFileInput(e.target);$('restoreFile').onchange=e=>readFileInput(e.target,true);
    $('restoreBtn').onclick=()=>$('restoreFile').click();
    function resetFilters(){
        $('searchBox').value=$('advSearch').value='';$('minLv').value=$('advMin').value=0;$('maxLv').value=$('advMax').value=100;
        $('statusFilter').value=$('advStatus').value='all';minSkin=0;$('advSkin').value=0;sortMode='original';$('sortBy').value='original';page=1;render();
    }
    $('clearFilter').onclick=$('advancedReset').onclick=resetFilters;
    ['searchBox','minLv','maxLv','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchBox'?'input':'change',()=>{page=1;render();}));
    $('applyFilter').onclick=()=>{if($('maxLv').value!==''&&num($('minLv').value)>num($('maxLv').value)){toast('Level tối đa phải lớn hơn hoặc bằng tối thiểu.');return;}page=1;render();};
    $('advancedApply').onclick=()=>{
        const min=num($('advMin').value),max=$('advMax').value===''?Infinity:num($('advMax').value);
        if(min>max){toast('Level tối đa phải lớn hơn hoặc bằng tối thiểu.');return;}
        $('searchBox').value=$('advSearch').value;$('statusFilter').value=$('advStatus').value;$('minLv').value=min;$('maxLv').value=Number.isFinite(max)?max:'';
        minSkin=num($('advSkin').value);sortMode=$('sortBy').value;page=1;render();toast(`Đã áp dụng bộ lọc: ${viewRows.length} tài khoản phù hợp.`);
    };
    $('pageSize').onchange=()=>{page=1;savePreferences();render();};$('prevPage').onclick=()=>{page--;render();};$('nextPage').onclick=()=>{page++;render();};
    $('headerCheck').onchange=e=>{const size=num($('pageSize').value)||10;viewRows.slice((page-1)*size,page*size).forEach(a=>e.target.checked?selected.add(a.id):selected.delete(a.id));render();};
    $('accountRows').onchange=e=>{const id=e.target.dataset.select;if(id){e.target.checked?selected.add(id):selected.delete(id);render();}};
    $('accountRows').onclick=e=>{const id=e.target.closest('[data-delete]')?.dataset.delete;if(!id)return;checkpoint('xóa tài khoản');accounts=accounts.filter(a=>a.id!==id);selected.delete(id);persist();render();toast('Đã xóa tài khoản. Có thể hoàn tác.');};
    function selectAllRows(){viewRows.forEach(a=>selected.add(a.id));render();}function deselectRows(){selected.clear();render();}
    $('selectAll').onclick=$('deletePageSelectAll').onclick=selectAllRows;$('deselectAll').onclick=$('deletePageDeselect').onclick=deselectRows;
    function deleteChosen(){const n=selected.size;if(!n){toast('Chưa chọn tài khoản nào.');return;}checkpoint('xóa '+n+' tài khoản');accounts=accounts.filter(a=>!selected.has(a.id));selected.clear();persist();render();toast(`Đã xóa ${n} tài khoản. Có thể hoàn tác.`);}
    $('deleteSelected').onclick=$('deletePageConfirm').onclick=deleteChosen;$('undoBtn').onclick=undo;
    $('copySelected').onclick=()=>copyText(chosen().map(a=>formatRow(a,'full')).join('\n'));
    const copyPage=mode=>copyText((selected.size?chosen():filtered()).map(a=>formatRow(a,mode)).join('\n'));
    document.querySelectorAll('[data-format]').forEach(button=>button.onclick=()=>copyPage(button.dataset.format));
    [['copyPageTk','tk'],['copyPageTkMk','tkmk'],['copyPageTkMkName','tkmkname'],['copyPageFull','full']].forEach(([id,mode])=>$(id).onclick=()=>copyPage(mode));
    ['exportBtn','advancedExport','exportPageVisible'].forEach(id=>$(id).onclick=()=>exportCsv(filtered()));$('exportPageAll').onclick=()=>exportCsv(accounts);
    $('saveSetBtn').onclick=()=>saveSet($('setName').value);$('saveSetBtn2').onclick=()=>saveSet($('saveName2').value);$('loadSetBtn').onclick=()=>loadSet($('savedSets').value);
    $('backupBtn').onclick=$('settingsBackup').onclick=backup;
    $('setsList').onclick=e=>{const load=e.target.closest('[data-loadset]')?.dataset.loadset,del=e.target.closest('[data-delset]')?.dataset.delset;if(load!==undefined)loadSet(load);if(del!==undefined){checkpoint('xóa bộ dữ liệu');delete sets[del];persist(true);render();toast('Đã xóa bộ dữ liệu. Có thể hoàn tác.');}};
    $('wipeBtn').onclick=()=>{if(!accounts.length){toast('Bảng đã trống.');return;}if(confirm('Xóa toàn bộ tài khoản trong bảng hiện tại?')){checkpoint('xóa toàn bộ bảng');accounts=[];selected.clear();persist();render();toast('Đã xóa dữ liệu. Có thể hoàn tác.');}};
            if ($('changePasswordForm')) $('changePasswordForm').addEventListener('submit', async e => {
                e.preventDefault();
                if (!supabaseClient || !currentUser || isLocalMode()) { toast('Hãy đăng nhập trước'); return; }
                const password = $('newAccountPassword').value;
                const confirmPassword = $('confirmAccountPassword').value;
                if (password.length < 8) { toast('Mật khẩu cần ít nhất 8 ký tự'); return; }
                if (password !== confirmPassword) { toast('Hai mật khẩu không khớp'); return; }
                const btn = $('changePasswordBtn'); btn.disabled = true; btn.textContent = 'Đang cập nhật…';
                try {
                    const { error } = await supabaseClient.auth.updateUser({ password });
                    if (error) throw error;
                    $('changePasswordForm').reset(); toast('Đã cập nhật mật khẩu thành công');
                } catch (err) { toast('Không đổi được mật khẩu: ' + (err.message || 'Thử đăng nhập lại')); }
                finally { btn.disabled = false; btn.textContent = 'Cập nhật mật khẩu'; }
            });
            if ($('refreshLoginHistory')) $('refreshLoginHistory').onclick = renderLoginHistory;
            if ($('clearLoginHistory')) $('clearLoginHistory').onclick = () => {
                if (confirm('Xóa lịch sử đăng nhập đã lưu trên trình duyệt này?')) { try { localStorage.removeItem(historyKey()); } catch (_) {} renderLoginHistory(); toast('Đã xóa lịch sử trên máy này'); }
            };
            document.querySelectorAll('[data-settings-pane]').forEach(btn => btn.addEventListener('click', () => {
                const pane = btn.dataset.settingsPane;
                document.querySelectorAll('[data-settings-pane]').forEach(b => b.classList.toggle('active', b === btn));
                document.querySelectorAll('[data-settings-content]').forEach(section => section.classList.toggle('hidden', section.dataset.settingsContent !== pane));
                const content = document.querySelector(`[data-settings-content="${pane}"]`);
                content?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }));
    document.querySelectorAll('label').forEach(label=>{if(label.htmlFor||label.querySelector('input,select,textarea'))return;const control=label.closest('.field')?.querySelector('input,select,textarea');if(control?.id)label.htmlFor=control.id;});
    setAuthMode('login');render();initAuth().catch(error=>{showAuthScreen();showAuthMessage(error.message||'Không thể khởi động. Hãy chọn Dùng trên máy.');});
})();
