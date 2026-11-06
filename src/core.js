
        (() => {
            'use strict';
            const $ = id => document.getElementById(id);
            // V5: Configuration is optional and loaded from config.js.
            // Do not commit a Supabase service_role/secret key to a public repository.
            const PUBLIC_CONFIG = window.GFP_CONFIG || {};
            const SUPABASE_URL = String(PUBLIC_CONFIG.supabaseUrl || '').trim();
            const SUPABASE_ANON_KEY = String(PUBLIC_CONFIG.supabaseAnonKey || '').trim();
            const isSupabaseConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)
                && /^(sb_publishable_|eyJ)/.test(SUPABASE_ANON_KEY);
            let supabaseClient = null, currentUser = null, authMode = 'login', cloudSaveTimer = null, authReady = false;
            let accounts = [], viewRows = [], selected = new Set(), page = 1, sortMode = 'original', restoreText = ''; let STORAGE = 'garena_filter_v23_rebuild';
            const cols = ['tk', 'mk', 'uid', 'name', 'lv', 'skin', 'ss', 'sss', 'rare', 'mystic', 'mail', 'phone'];
            function toast(s) { const t = $('toast'); t.textContent = s; t.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => t.style.display = 'none', 2500) }
            function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
            function historyKey() { return 'gfp_login_history_' + (currentUser?.id || 'guest') }
            function getLoginHistory() { try { const v = JSON.parse(localStorage.getItem(historyKey()) || '[]'); return Array.isArray(v) ? v : [] } catch (_) { return [] } }
            function recordLoginHistory() {
                if (!currentUser) return;
                const list = getLoginHistory();
                list.unshift({ at: new Date().toISOString(), email: currentUser.email || '', device: navigator.userAgent || 'Trình duyệt không xác định' });
                try { localStorage.setItem(historyKey(), JSON.stringify(list.slice(0, 30))); } catch (_) {}
                renderLoginHistory();
            }
            function renderLoginHistory() {
                const el = $('loginHistoryList'); if (!el) return;
                const list = getLoginHistory();
                el.innerHTML = list.length ? list.map(item => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>${esc(new Date(item.at).toLocaleString())}</b><div>${esc(item.email || '')}</div><div class="small" style="overflow-wrap:anywhere">${esc(item.device || '')}</div></div>`).join('') : 'Chưa có lịch sử đăng nhập trên trình duyệt này.';
            }
            function updateAccountInfo() {
                if ($('accountEmailReadOnly')) $('accountEmailReadOnly').value = isLocalMode() ? 'Dữ liệu trên trình duyệt này' : (currentUser?.email || 'Chưa đăng nhập');
                if ($('accountUserId')) $('accountUserId').value = isLocalMode() ? 'Chế độ trên máy' : (currentUser?.id || '—');
                renderLoginHistory();
            }
    const MAX_ROWS = 100000, MAX_FILE_BYTES = 20 * 1024 * 1024;
    const numberCols = ['lv','skin','ss','sss','rare','mystic'];
    const statusNames = ['ACC TRẮNG LỖI PASS','ACC TRẮNG','DÍNH MAIL','DÍNH SỐ','ACC FULL','CÓ SKIN','ACC THƯỜNG'];
    let minSkin = 0, showPasswords = false, sets = Object.create(null);
    const undoStack = [];
    const uid = () => globalThis.crypto?.randomUUID?.() || `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    function num(v) { const n = Number(String(v ?? '').trim()); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0; }
    function countValue(v) { const m = String(v ?? '').match(/^\s*(\d+)/); return m ? num(m[1]) : 0; }
    function fieldKey(v) { return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toUpperCase().replace(/[\s_-]+/g,''); }
    const aliases = {TK:'tk',TAIKHOAN:'tk',USERNAME:'tk',ACCOUNT:'tk',MK:'mk',MATKHAU:'mk',PASSWORD:'mk',PASS:'mk',UID:'uid',NAME:'name',TEN:'name',LV:'lv',LEVEL:'lv',SKIN:'skin',SS:'ss',SSS:'sss',SKINHIEM:'rare',RARE:'rare',MYSTIC:'mystic',EMAIL:'mail',MAIL:'mail',PHONE:'phone',SDT:'phone',SODT:'phone',SODIENTHOAI:'phone',STATUS:'declaredStatus',TINHTRANG:'declaredStatus',TRANGTHAI:'declaredStatus',EXTRA:'extra'};
    function declaredStatusOf(v) {
        const s=fieldKey(v);
        if (/TRANGLOIPASS|LOIPASS/.test(s)) return 'ACC TRẮNG LỖI PASS';
        if (/ACCTRANG|^TRANG$/.test(s)) return 'ACC TRẮNG';
        if (/DINHMAIL/.test(s)) return 'DÍNH MAIL';
        if (/DINH(SO|SDT|DIENTHOAI)/.test(s)) return 'DÍNH SỐ';
        if (/ACCFULL|^FULL$/.test(s)) return 'ACC FULL';
        if (s==='COSKIN') return 'CÓ SKIN';
        if (s==='ACCTHUONG') return 'ACC THƯỜNG';
        return '';
    }
    function normalizeRow(parts, header=null) {
        const p = parts.map(x => String(x ?? ''));
        const out = Object.fromEntries(cols.map(k=>[k,numberCols.includes(k)?0:'']));
        out.declaredStatus=''; out.extra='';
        if (header) {
            header.forEach((k,i)=>{ if(k) out[k]=p[i]??''; });
        } else {
            out.tk=(p[0]||'').trim(); out.mk=p[1]||'';
            const fields=Object.create(null);
            for(const part of p.slice(2)) {
                const m=part.match(/^\s*([^:|]+?)\s*:\s*([\s\S]*)$/);
                const key=m && aliases[fieldKey(m[1])];
                if(key) fields[key]=m[2].trim();
            }
            if(Object.keys(fields).length) Object.assign(out,fields);
            else if(p.length<=4) {out.name=p[2]||'';out.lv=p[3]||0;}
            else {cols.slice(2).forEach((key,i)=>out[key]=p[i+2]??''); const legacyExtra=p[12]&&!declaredStatusOf(p[12]); out.declaredStatus=legacyExtra?'':(p[12]||''); out.extra=p.slice(legacyExtra?12:13).join('|');}
        }
        out.tk=out.tk.trim();
        numberCols.forEach(k=>out[k]=countValue(out[k]));
        out.declaredStatus=declaredStatusOf(out.declaredStatus);
        // Only explicit phone/email columns are used; a numeric UID is never a phone.
        out.mail=String(out.mail).trim(); out.phone=String(out.phone).trim();
        out.id=uid();out.raw=p.join('|');return out;
    }
    function detectDelimiter(text) {
        const first=text.split(/\r?\n/).find(x=>x.trim())||'';
        const counts=new Map(['|','\t',';',','].map(x=>[x,0])); let quoted=false;
        for(let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&counts.has(c))counts.set(c,counts.get(c)+1);}
        return [...counts].sort((a,b)=>b[1]-a[1])[0][0];
    }
    function readRecords(text, delimiter='auto') {
        text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
        const delim=delimiter==='auto'?detectDelimiter(text):(delimiter==='tab'?'\t':delimiter);
        const rows=[];let row=[],field='',quoted=false,closed=false;
        const pushField=()=>{row.push(field);field='';closed=false;};
        const pushRow=()=>{pushField();if(row.some(x=>x.trim()))rows.push(row);row=[];if(rows.length>MAX_ROWS)throw Error('Tối đa 100.000 dòng mỗi lần nhập.');};
        for(let i=0;i<text.length;i++) {
            const c=text[i];
            if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else {quoted=false;closed=true;}}else field+=c;}
            else if(c===delim)pushField();
            else if(c==='\n')pushRow();
            else if(c==='"'&&field===''){quoted=true;}
            else {if(closed&&c.trim())throw Error('CSV không hợp lệ: có ký tự sau dấu nháy đóng.'); if(!closed)field+=c;}
        }
        if(quoted)throw Error('CSV chưa đóng dấu nháy. Kiểm tra dữ liệu rồi nhập lại.');
        if(field||row.length)pushRow();return rows;
    }
    function rowKey(row) { return JSON.stringify([...cols,'declaredStatus','extra'].map(k=>row[k])); }
    function parseText(text, delim='auto', dedupe=true) {
        if(text.length>MAX_FILE_BYTES)throw Error('Dữ liệu vượt quá giới hạn 20 MB.');
        const records=readRecords(text,delim);let header=null,skipped=0,duplicates=0;
        if(records[0]){const h=records[0].map(x=>aliases[fieldKey(x)]||null);if(h.includes('tk')&&h.includes('mk')){header=h;records.shift();}}
        const seen=new Set(),rows=[];
        for(const parts of records){
            const a=normalizeRow(parts,header);
            if(parts.length<2||!a.tk){skipped++;continue;}
            const key=rowKey(a);if(dedupe&&seen.has(key)){duplicates++;continue;}
            seen.add(key);rows.push(a);
        }
        return {rows,skipped,duplicates};
    }
    const dedupeSessions={rawData:0,parserInput:0};
    const dedupeTimers={};
    function cleanEditor(id) {
        const editor=$(id), target=$(id==='rawData'?'rawDedupeInfo':'parserDedupeInfo');
        if(!editor)return;
        const lines=editor.value.split(/\r?\n/).filter(s=>s.trim());
        if(target)target.textContent=lines.length?`${lines.length.toLocaleString('vi-VN')} dòng văn bản · Kiểm tra khi xử lý, giữ nguyên ô nhập`:'Hỗ trợ TXT, CSV, dấu |, chấm phẩy và tab.';
    }
    ['rawData','parserInput'].forEach(id=>$(id).addEventListener('input',()=>{clearTimeout(dedupeTimers[id]);dedupeTimers[id]=setTimeout(()=>cleanEditor(id),200);}));
    function status(a){if(a.declaredStatus)return a.declaredStatus;if(a.mail)return 'DÍNH MAIL';if(a.phone)return 'DÍNH SỐ';if(hasSkin(a))return 'CÓ SKIN';if(a.lv>=30)return 'ACC FULL';return 'ACC THƯỜNG';}
    function hasSkin(a){return ['skin','ss','sss','rare','mystic'].some(k=>a[k]>0);}
    function isFull(a){return a.declaredStatus?a.declaredStatus==='ACC FULL':a.lv>=30;}
    function filtered(){
        const q=$('searchBox').value.trim().toLocaleLowerCase('vi');
        const min=num($('minLv').value),max=$('maxLv').value===''?Infinity:num($('maxLv').value),st=$('statusFilter').value;
        let arr=accounts.filter(a=>{
            const text=[a.tk,a.mk,a.uid,a.name,a.mail,a.phone,a.declaredStatus].join(' ').toLocaleLowerCase('vi');
            const match=st==='all'||st==='full'&&isFull(a)||st==='blankpass'&&a.declaredStatus===statusNames[0]||st==='blank'&&a.declaredStatus===statusNames[1]||st==='mail'&&(a.mail||a.declaredStatus==='DÍNH MAIL')||st==='phone'&&(a.phone||a.declaredStatus==='DÍNH SỐ')||st==='skin'&&hasSkin(a)||st==='none'&&!hasSkin(a);
            return (!q||text.includes(q))&&a.lv>=min&&a.lv<=max&&a.skin>=minSkin&&match;
        });
        const sorts={lv:(a,b)=>a.lv-b.lv,lvdesc:(a,b)=>b.lv-a.lv,skin:(a,b)=>a.skin-b.skin,skindesc:(a,b)=>b.skin-a.skin,name:(a,b)=>a.name.localeCompare(b.name,'vi',{numeric:true})};
        if(sorts[sortMode])arr.sort(sorts[sortMode]);return arr;
    }
    function render(){
        const ids=new Set(accounts.map(a=>a.id)); for(const id of selected)if(!ids.has(id))selected.delete(id);
        viewRows=filtered();const size=num($('pageSize').value)||10, pages=Math.max(1,Math.ceil(viewRows.length/size));page=Math.max(1,Math.min(page,pages));
        const slice=viewRows.slice((page-1)*size,page*size);
        $('accountRows').innerHTML=slice.length?slice.map(a=>`<tr class="${selected.has(a.id)?'is-selected':''}"><td><input type="checkbox" data-select="${esc(a.id)}" aria-label="Chọn ${esc(a.tk)}" ${selected.has(a.id)?'checked':''}></td><td class="account-name">${esc(a.tk)}</td><td class="password-cell">${showPasswords?esc(a.mk):(a.mk?'••••••':'—')}</td><td>${esc(a.uid)}</td><td>${esc(a.name)}</td>${numberCols.map(k=>`<td>${esc(a[k])}</td>`).join('')}<td>${esc(a.mail)}</td><td>${esc(a.phone)}</td><td><span class="tag ${status(a)==='ACC THƯỜNG'?'gray':''}">${esc(status(a))}</span></td><td><button class="btn row-delete" data-delete="${esc(a.id)}" aria-label="Xóa ${esc(a.tk)}" title="Xóa dòng">×</button></td></tr>`).join(''):`<tr><td colspan="15" class="empty"><div class="empty-symbol">${accounts.length?'⌕':'▤'}</div><strong>${accounts.length?'Không có kết quả phù hợp':'Không gian dữ liệu của bạn'}</strong><p>${accounts.length?'Thử đổi từ khóa hoặc đặt lại bộ lọc.':'Dán dữ liệu, mở file hoặc thử dữ liệu mẫu để bắt đầu.'}</p></td></tr>`;
        $('countLabel').textContent=`${viewRows.length.toLocaleString('vi-VN')} / ${accounts.length.toLocaleString('vi-VN')} tài khoản`;
        $('pageInfo').textContent=viewRows.length?`${(page-1)*size+1}–${Math.min(page*size,viewRows.length)} trong ${viewRows.length} kết quả`:'0 kết quả';
        $('pageNumber').textContent=`${page} / ${pages}`;$('prevPage').disabled=page<=1;$('nextPage').disabled=page>=pages;
        const n=slice.filter(a=>selected.has(a.id)).length;$('headerCheck').checked=n>0&&n===slice.length;$('headerCheck').indeterminate=n>0&&n<slice.length;
        if($('selectionCount'))$('selectionCount').textContent=`Đã chọn ${selected.size}`;
        $('deletePageCount').textContent=selected.size;
        if($('undoBtn'))$('undoBtn').disabled=!undoStack.length;
        ['deleteSelected','copySelected','deletePageConfirm'].forEach(id=>$(id).disabled=selected.size===0);
        const active=[];if($('searchBox').value.trim())active.push('Từ khóa: '+$('searchBox').value.trim());if($('statusFilter').value!=='all')active.push($('statusFilter').selectedOptions[0]?.textContent);if(num($('minLv').value)>0||$('maxLv').value!=='100')active.push(`Level ${$('minLv').value||0}–${$('maxLv').value||'∞'}`);if(minSkin)active.push(`Skin ≥ ${minSkin}`);
        if($('filterSummary'))$('filterSummary').textContent=active.length?active.join(' · '):'Hiển thị theo bộ lọc hiện tại';
        updateStats();renderSetsList();
    }
    function updateStats(){
        $('statTotal').textContent=accounts.length;$('statFull').textContent=accounts.filter(isFull).length;
        $('statMail').textContent=accounts.filter(a=>a.mail||a.declaredStatus==='DÍNH MAIL').length;
        $('statPhone').textContent=accounts.filter(a=>a.phone||a.declaredStatus==='DÍNH SỐ').length;
        $('statBlankPass').textContent=accounts.filter(a=>a.declaredStatus===statusNames[0]).length;$('statBlank').textContent=accounts.filter(a=>a.declaredStatus===statusNames[1]).length;
    }
    function validatePayload(payload){
        if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.accounts))throw Error('Backup phải chứa danh sách accounts.');
        let total=0;
        function rows(value){
            if(!Array.isArray(value)||(total+=value.length)>MAX_ROWS*3)throw Error('Backup quá lớn hoặc bộ dữ liệu không hợp lệ.');
            const used=new Set();
            return value.map((r,i)=>{
                if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.tk!=='string'||!r.tk.trim())throw Error(`Dòng ${i+1}: tài khoản không hợp lệ.`);
                const a={};for(const k of [...cols,'declaredStatus','raw','extra']){
                    const v=r[k]??(numberCols.includes(k)?0:'');
                    if(numberCols.includes(k)){if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v)))throw Error(`Dòng ${i+1}: cột ${k} không hợp lệ.`);a[k]=Number(v);}
                    else {if(!['string','number'].includes(typeof v))throw Error(`Dòng ${i+1}: cột ${k} không hợp lệ.`);a[k]=String(v);if(a[k].length>1000000)throw Error('Một ô dữ liệu quá dài.');}
                }
                a.declaredStatus=declaredStatusOf(a.declaredStatus);a.id=typeof r.id==='string'&&r.id.length<150&&!used.has(r.id)?r.id:uid();used.add(a.id);return a;
            });
        }
        const clean={accounts:rows(payload.accounts),sets:Object.create(null)};
        if(payload.sets!==undefined){if(!payload.sets||typeof payload.sets!=='object'||Array.isArray(payload.sets))throw Error('Danh sách bộ dữ liệu không hợp lệ.');for(const [k,v] of Object.entries(payload.sets)){if(k.length>120)throw Error('Tên bộ dữ liệu quá dài.');clean.sets[k]=rows(v);}}
        return clean;
    }
    function checkpoint(label){
        undoStack.push({accounts:accounts.slice(),sets:Object.assign(Object.create(null),sets),label});
        while(undoStack.length>10||undoStack.length>1&&undoStack.reduce((n,x)=>n+x.accounts.length,0)>MAX_ROWS)undoStack.shift();
    }
    function undo(){const prev=undoStack.pop();if(!prev)return;accounts=prev.accounts;sets=prev.sets;selected.clear();page=1;persist();render();toast('Đã hoàn tác: '+prev.label);}
    function refreshSetSelect(){const el=$('savedSets'),old=el.value;el.innerHTML='<option value="">Chọn bộ dữ liệu</option>'+Object.keys(sets).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');if(Object.hasOwn(sets,old))el.value=old;}
    function renderSetsList(){const names=Object.keys(sets);$('setsList').innerHTML=names.length?names.map(n=>`<div class="saved-set-row"><div><b>${esc(n)}</b><div class="small">${sets[n].length} tài khoản</div></div><button class="btn primary" data-loadset="${esc(n)}">Mở</button><button class="btn" data-delset="${esc(n)}">Xóa</button></div>`).join(''):'Chưa có bộ dữ liệu. Đặt tên và lưu dữ liệu hiện tại để mở lại sau.';refreshSetSelect();}
    function saveSet(name){name=String(name||'').trim();if(!name||name.length>120){toast('Tên bộ dữ liệu cần từ 1 đến 120 ký tự.');return;}if(Object.hasOwn(sets,name)&&!confirm('Ghi đè bộ dữ liệu “'+name+'”?'))return;checkpoint('lưu bộ dữ liệu');sets[name]=accounts.map(a=>({...a}));persist(true);render();toast('Đã lưu bộ dữ liệu: '+name);}
    function loadSet(name){if(!Object.hasOwn(sets,name)){toast('Chọn một bộ dữ liệu để mở.');return;}checkpoint('mở bộ dữ liệu');accounts=sets[name].map(a=>({...a}));selected.clear();page=1;persist();render();toast('Đã mở: '+name);}
            function showPage(name) {
                const target = $('page-' + name);
                if (!target) { console.warn('Không tìm thấy trang:', name); return; }
                document.querySelectorAll('.content .page').forEach(p => {
                    const active = p === target;
                    p.classList.toggle('hidden', !active);
                    p.style.display = active ? 'block' : 'none';
                    p.setAttribute('aria-hidden', String(!active));
                });
                document.querySelectorAll('.nav[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === name));
                const labels = {dashboard:'Dashboard • Tổng quan tài khoản',parser:'Parser Data • Chuyển đổi dữ liệu',filter:'Filter • Lọc nâng cao',saves:'Save Set • Bộ dữ liệu đã lưu',settings:'Settings • Cấu hình',copy:'Copy Format • Sao chép dữ liệu',export:'Export CSV • Xuất dữ liệu',delete:'Xóa đã chọn • Quản lý dữ liệu',
                    'tool-2fa':'Công cụ • Garena & 2FA Google','tool-sequence':'Công cụ • Tạo tài khoản tăng dần','tool-chain':'Công cụ • Tăng Chuỗi Account','tool-sort':'Công cụ • Sắp xếp username theo số','tool-split':'Công cụ • Tách Chuỗi','tool-replace':'Công cụ • Thay Thế Văn Bản','tool-dedupe':'Công cụ • Lọc Trùng Dòng','tool-authen-merge':'Công cụ • Ghép Authen','tool-join':'Công cụ • Ghép nhiều cột','tool-skin-file':'Công cụ • Account Skin','tool-missing':'Công cụ • Lọc Account Bị Thiếu','tool-outlook':'Công cụ • Mail Reader Microsoft','tool-mail-code':'Công cụ • Tìm mã xác minh trong thư'};
                $('crumb').textContent = labels[name] || name;
                setMobileMenu(false);
                const main = document.querySelector('.main'); if(main) main.scrollTop = 0;
            }
    function importText(text,delim='auto',source=''){
        try{
            const dedupe=$('importDedupe')?.checked!==false;
            const parsed=parseText(text,delim,dedupe);let rows=parsed.rows,duplicates=parsed.duplicates;
            if(!rows.length){toast(`Không có tài khoản hợp lệ. Bỏ qua ${parsed.skipped} dòng. Cần ít nhất TK|MK.`);return;}
            const append=$('importMode')?.value==='append';
            if(append&&dedupe){const seen=new Set(accounts.map(rowKey));rows=rows.filter(a=>{const key=rowKey(a);if(seen.has(key)){duplicates++;return false;}seen.add(key);return true;});}
            if((append?accounts.length:0)+rows.length>MAX_ROWS)throw Error('Bảng chỉ nhận tối đa 100.000 tài khoản.');
            checkpoint('nhập dữ liệu');accounts=append?accounts.concat(rows):rows;selected.clear();page=1;
            if($('rawData').value!==text)$('rawData').value=text;if($('parserInput').value!==text)$('parserInput').value=text;cleanEditor('rawData');cleanEditor('parserInput');
            const message=`Đã nhập ${rows.length} tài khoản · ${duplicates} dòng trùng · ${parsed.skipped} dòng không hợp lệ`;
            $('parseStatus').textContent=message;render();persist();toast(message);
        }catch(e){toast(e.message||'Không đọc được dữ liệu.');}
    }
    async function copyText(text){
        if(!text){toast('Chưa có dữ liệu để sao chép.');return false;}
        try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);toast('Đã sao chép vào clipboard.');return true;}
        catch(_){const focused=document.activeElement,ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}ta.remove();focused?.focus({preventScroll:true});toast(ok?'Đã sao chép vào clipboard.':'Không sao chép được. Hãy chọn văn bản và dùng Ctrl/Cmd+C.');return ok;}
    }
    function chosen(){return accounts.filter(a=>selected.has(a.id));}
    function formatRow(a,mode){if(mode==='tk')return a.tk;const keys=mode==='tkmk'?['tk','mk']:mode==='tkmkname'?['tk','mk','name']:[...cols,'declaredStatus','extra'];return keys.map(k=>{const s=String(a[k]??'');return /[|\r\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join('|');}
    function download(name,content,type='text/plain;charset=utf-8'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
    function exportCsv(rows=accounts){
        if(!rows.length){toast('Chưa có dữ liệu để xuất.');return;}
        const keys=[...cols,'declaredStatus','extra'],head=['TK','MK','UID','NAME','LV','SKIN','SS','SSS','SKIN_HIEM','MYSTIC','MAIL','PHONE','STATUS','EXTRA'];
        const quote=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
        download('garena-accounts.csv','\uFEFF'+[head.join(','),...rows.map(a=>keys.map(k=>quote(a[k])).join(','))].join('\r\n'),'text/csv;charset=utf-8');toast(`Đã xuất ${rows.length} tài khoản.`);
    }
    function backup(){download('garena-filter-backup.json',JSON.stringify({version:'4.0',exportedAt:new Date().toISOString(),accounts,sets},null,2),'application/json');}
    function clearWorkspace(){
        accounts=[];viewRows=[];sets=Object.create(null);selected.clear();undoStack.length=0;page=1;showPasswords=false;minSkin=0;
        document.querySelectorAll('textarea').forEach(el=>el.value='');
        document.querySelectorAll('input[type="password"]').forEach(el=>el.value='');
        if($('totpSecret'))$('totpSecret').value='';$('totpClear')?.click();
        $('togglePassword').textContent='◉ Hiện mật khẩu';$('togglePassword').setAttribute('aria-pressed','false');
        $('searchBox').value='';$('minLv').value=0;$('maxLv').value=100;$('statusFilter').value='all';sortMode='original';
        document.dispatchEvent(new Event('gfp-workspace-cleared'));render();
    }
