            // Text utilities run locally. Tool contents and 2FA secrets are never persisted.
            const TOOL_MAX_INPUT = 5 * 1024 * 1024, TOOL_MAX_OUTPUT = 10 * 1024 * 1024, TOOL_MAX_ROWS = 50000;
            const toolVal = id => String($(id)?.value ?? '');
            const setTool = (id, value) => {
                const text = String(value ?? '');
                if (text.length > TOOL_MAX_OUTPUT) throw Error('Kết quả quá lớn. Hãy chia nhỏ dữ liệu (tối đa 10 MB).');
                if ($(id)) $(id).value = text;
            };
            function toolLines(text, preserveEmpty = false) {
                text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
                if (text.length > TOOL_MAX_INPUT) throw Error('Dữ liệu quá lớn. Mỗi ô tối đa 5 MB.');
                if (!text) return [];
                const lines = text.split('\n');
                // One final newline terminates the last record; interior empty rows retain their position.
                if (lines[lines.length - 1] === '') lines.pop();
                if (lines.length > TOOL_MAX_ROWS) throw Error('Tối đa 50.000 dòng mỗi lần. Hãy chia nhỏ dữ liệu.');
                return preserveEmpty ? lines : lines.filter(x => x.trim() !== '');
            }
            function toolInteger(id, min = 1, max = TOOL_MAX_ROWS) {
                const raw = toolVal(id).trim(), value = Number(raw);
                if (!raw || !Number.isSafeInteger(value) || value < min || value > max) throw Error(`Nhập số nguyên từ ${min} đến ${max}.`);
                return value;
            }
            function toolDelimiter(id, allowEmpty = false) {
                const value = toolVal(id).replace(/\\t/g, '\t');
                if (!value && !allowEmpty) throw Error('Nhập ký tự phân cách; dùng \\t cho tab.');
                if (/\r|\n/.test(value)) throw Error('Ký tự phân cách không được chứa xuống dòng.');
                return value;
            }
            function toolAction(id, output, callback) {
                $(id).onclick = () => {
                    try { callback(); }
                    catch (error) { if ($(output)) $(output).value = ''; toast(error.message || 'Không xử lý được dữ liệu.'); }
                };
            }
            function checkToolInput(...ids) {
                ids.forEach(id => { if (toolVal(id).length > TOOL_MAX_INPUT) throw Error('Dữ liệu quá lớn. Mỗi ô tối đa 5 MB.'); });
            }
            const literalReplace = (text, find, replacement, all, caseSensitive) => {
                if (!find) return {text, count: 0};
                const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(escaped, (all ? 'g' : '') + (caseSensitive ? '' : 'i') + 'u');
                let count = 0, projected = text.length, match;
                while ((match = pattern.exec(text)) !== null) {
                    count++; projected += replacement.length - match[0].length;
                    if (projected > TOOL_MAX_OUTPUT) throw Error('Kết quả thay thế vượt 10 MB. Hãy chia nhỏ dữ liệu.');
                    if (!all) break;
                }
                pattern.lastIndex = 0;
                const result = text.replace(pattern, () => replacement);
                if (result.length > TOOL_MAX_OUTPUT) throw Error('Kết quả thay thế vượt 10 MB. Hãy chia nhỏ dữ liệu.');
                return {text: result, count};
            };
            toolAction('seqRun', 'seqOutput', () => {
                const base = toolVal('seqBase').trim(), password = toolVal('seqPassword');
                const a = toolInteger('seqStart', 0, 100000000), b = toolInteger('seqEnd', 0, 100000000);
                if (!base) throw Error('Hãy nhập tên tài khoản gốc.');
                if (/[\r\n|]/.test(base) || /[\r\n|]/.test(password)) throw Error('Tên và mật khẩu không được chứa xuống dòng hoặc dấu |.');
                if (b < a || b - a + 1 > 20000) throw Error('Khoảng số không hợp lệ hoặc vượt 20.000 dòng.');
                const suffix = toolVal('seqFormat') === 'both' ? '|' + password : '';
                if ((base.length + suffix.length + 12) * (b - a + 1) > TOOL_MAX_OUTPUT) throw Error('Kết quả vượt 10 MB. Hãy giảm số dòng.');
                setTool('seqOutput', Array.from({length: b - a + 1}, (_, i) => `${base}${a + i}${suffix}`).join('\n'));
                $('seqCount').textContent = `Đã tạo ${b - a + 1} dòng.`;
            });
            toolAction('chainRun', 'chainOutput', () => {
                const rows = toolLines(toolVal('chainInput'), true), prefix = toolVal('chainPrefix'), suffix = toolVal('chainSuffix');
                if ((prefix.length + suffix.length) * rows.length + toolVal('chainInput').length > TOOL_MAX_OUTPUT) throw Error('Kết quả vượt 10 MB.');
                setTool('chainOutput', rows.map(line => prefix + line + suffix).join('\n'));
            });
            const usernameNumber = line => {
                const digits = line.split('|', 1)[0].match(/\d+/)?.[0];
                return digits == null ? null : BigInt(digits);
            };
            toolAction('sortRun', 'sortOutput', () => {
                const rows = toolLines(toolVal('sortInput')).map(text => ({text, number: usernameNumber(text)}));
                const mode = toolVal('sortModeTool'), collator = new Intl.Collator('vi', {numeric: true, sensitivity: 'base'});
                rows.sort((a, b) => {
                    if (mode === 'num-asc' || mode === 'num-desc') {
                        if ((a.number === null) !== (b.number === null)) return a.number === null ? 1 : -1;
                        const delta = a.number !== null && b.number !== null ? (a.number < b.number ? -1 : a.number > b.number ? 1 : 0) : 0;
                        return delta * (mode === 'num-desc' ? -1 : 1) || collator.compare(a.text, b.text);
                    }
                    if (mode === 'status') {
                        const hasStatus = text => /(?:^|[|;\t])\s*(?:status|tình trạng|trạng thái)\s*:/i.test(text);
                        return Number(hasStatus(b.text)) - Number(hasStatus(a.text)) || collator.compare(a.text, b.text);
                    }
                    return collator.compare(a.text, b.text) * (mode === 'desc' ? -1 : 1);
                });
                setTool('sortOutput', rows.map(row => row.text).join('\n'));
                $('sortCount').textContent = `Đã sắp xếp ${rows.length} dòng.`;
            });
            toolAction('splitRun', 'splitOutput', () => {
                const delimiter = toolDelimiter('splitDelimiter'), lines = toolLines(toolVal('splitInput'), true);
                const wrap = $('splitColumns'); wrap.replaceChildren();
                let cells = lines.length;
                for (const line of lines) {
                    let at = 0;
                    while ((at = line.indexOf(delimiter, at)) !== -1) { at += delimiter.length; if (++cells > 250000) throw Error('Tối đa 250.000 ô mỗi lần tách.'); }
                }
                const rows = lines.map(line => line.split(delimiter));
                const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
                $('splitStats').textContent = `${rows.length} dòng · ${width} cột`;
                if (!rows.length) { setTool('splitOutput', ''); return; }
                const mode = toolVal('splitMode');
                if (mode === 'lines') { setTool('splitOutput', rows.flat().map(value => value.trim()).filter(Boolean).join('\n')); return; }
                if (mode === 'number') {
                    const column = toolInteger('splitColumn', 1, 250000) - 1;
                    if (column >= width) throw Error(`Dữ liệu chỉ có ${width} cột.`);
                    setTool('splitOutput', rows.map(row => (row[column] ?? '').trim()).join('\n')); return;
                }
                const limited = Math.min(width, 40);
                if (width > limited) toast('Chỉ hiển thị 40 cột đầu; kết quả TXT vẫn chứa đủ các cột.');
                for (let column = 0; column < limited; column++) {
                    const values = rows.map(row => (row[column] ?? '').trim()).join('\n');
                    const card = document.createElement('div'); card.className = 'split-column';
                    const head = document.createElement('div'); head.className = 'split-column-head';
                    const title = document.createElement('b'); title.textContent = 'Cột ' + (column + 1);
                    const copy = document.createElement('button'); copy.className = 'btn'; copy.type = 'button'; copy.textContent = 'Sao chép'; copy.onclick = () => copyText(values);
                    const textarea = document.createElement('textarea'); textarea.readOnly = true; textarea.value = values; textarea.setAttribute('aria-label', title.textContent);
                    const field = document.createElement('div'); field.className = 'field'; field.appendChild(textarea);
                    head.append(title, copy); card.append(head, field); wrap.appendChild(card);
                }
                setTool('splitOutput', rows.map(row => row.join('\t')).join('\n'));
            });
            $('splitMode').addEventListener('change', () => $('splitColumns').replaceChildren());
            toolAction('replaceRun', 'replaceOutput', () => {
                checkToolInput('replaceInput', 'replaceFind', 'replaceWith');
                let input = toolVal('replaceInput');
                const find = toolVal('replaceFind').replace(/\r\n?/g, '\n').split('\n'), replacement = toolVal('replaceWith').replace(/\r\n?/g, '\n').split('\n');
                if (!find.some(Boolean)) throw Error('Nhập ít nhất một chuỗi cần tìm.');
                if (find.length > 1000 || input.length * find.length > 100000000) throw Error('Quá nhiều cặp thay thế. Hãy chia nhỏ dữ liệu.');
                let count = 0;
                find.forEach((value, index) => {
                    if (!value) return;
                    const result = literalReplace(input, value, replacement[index] ?? '', $('replaceAll').checked, $('replaceCase').checked);
                    input = result.text; count += result.count;
                });
                setTool('replaceOutput', input); $('replaceCount').textContent = `Đã thay ${count} lần. Các cặp được áp dụng lần lượt.`;
            });
            toolAction('dedupeRun', 'dedupeOutput', () => {
                const lines = toolLines(toolVal('dedupeInput')), seen = new Set(), output = [];
                const mode = toolVal('dedupeMode'), delimiter = mode === 'column' ? toolDelimiter('dedupeDelimiter') : '';
                const column = mode === 'column' ? toolInteger('dedupeColumn') - 1 : 0;
                let missing = 0, outputLength = 0;
                for (const line of lines) {
                    const replaced = literalReplace(line, toolVal('dedupeFind'), toolVal('dedupeReplace'), true, true).text;
                    let key = mode === 'column' ? replaced.split(delimiter)[column] : replaced;
                    // Missing columns are malformed records, not a shared empty identity. Preserve them.
                    if (key === undefined) { missing++; }
                    else {
                        if ($('dedupeTrim').checked) key = key.trim();
                        if (!$('dedupeCase').checked) key = key.toLocaleLowerCase('vi');
                        if (seen.has(key)) continue;
                        seen.add(key);
                    }
                    outputLength += replaced.length + 1;
                    if (outputLength > TOOL_MAX_OUTPUT) throw Error('Kết quả vượt 10 MB.');
                    output.push(replaced);
                }
                setTool('dedupeOutput', output.join('\n'));
                $('dedupeCount').textContent = `Tổng: ${lines.length} dòng · Giữ: ${output.length} · Trùng: ${lines.length - output.length}${missing ? ` · Giữ nguyên ${missing} dòng thiếu cột so sánh` : ''}`;
            });
            toolAction('missingRun', 'missingOutput', () => {
                const delimiter = toolDelimiter('missingDelimiter'), minimum = toolInteger('missingMin', 1, 1000);
                const lines = toolLines(toolVal('missingInput'));
                const missing = lines.filter(line => { const parts = line.split(delimiter); return parts.length < minimum || parts.slice(0, minimum).some(part => !part.trim()); });
                setTool('missingOutput', missing.join('\n'));
                $('missingCount').textContent = `Tổng ${lines.length} dòng; phát hiện ${missing.length} dòng thiếu trường hoặc có trường trống.`;
            });
            toolAction('authRun', 'authOutput', () => {
                const delimiter = toolDelimiter('authDelimiter'), source = new Map(), conflicts = new Set();
                let skipped = 0;
                toolLines(toolVal('authSource')).forEach(line => {
                    const parts = line.split(delimiter), user = (parts[0] ?? '').trim().toLocaleLowerCase('vi');
                    const configured = toolVal('authColumn'), index = configured === 'last' ? parts.length - 1 : Number(configured) - 1;
                    const code = (parts[index] ?? '').trim();
                    if (parts.length < 2 || !user || !code || !Number.isInteger(index) || index < 1) { skipped++; return; }
                    if (source.has(user) && source.get(user) !== code) conflicts.add(user);
                    else source.set(user, code);
                });
                let found = 0, missing = 0, conflictRows = 0, mergedLength = toolVal('authBase').length;
                const output = toolLines(toolVal('authBase'), true).map(line => {
                    if (!line.trim()) return line;
                    const user = line.split(delimiter, 1)[0].trim().toLocaleLowerCase('vi');
                    if (conflicts.has(user)) { conflictRows++; return line; }
                    if (!source.has(user)) { missing++; return line; }
                    const code = source.get(user); found++;
                    mergedLength += code.length + delimiter.length;
                    if (mergedLength > TOOL_MAX_OUTPUT) throw Error('Kết quả ghép vượt 10 MB. Hãy chia nhỏ dữ liệu.');
                    return line.endsWith(delimiter + code) ? line : line + delimiter + code;
                });
                setTool('authOutput', output.join('\n'));
                $('authCount').textContent = `Ghép ${found} dòng · Không tìm thấy ${missing} · Nguồn thiếu Authen ${skipped} · Giữ nguyên ${conflictRows} dòng có mã nguồn mâu thuẫn.`;
            });
            function joinAdd() {
                const count = $('joinFields').children.length;
                if (count >= 20) { toast('Tối đa 20 cột.'); return; }
                const card = document.createElement('div'); card.className = 'join-column';
                const title = document.createElement('h3'); title.textContent = 'Cột ' + (count + 1);
                const hint = document.createElement('p'); hint.className = 'small'; hint.textContent = 'Một dòng dùng cho mọi hàng. Dòng trống ở giữa được giữ nguyên.';
                const textarea = document.createElement('textarea'); textarea.className = 'join-value'; textarea.placeholder = 'Mỗi hàng 1 giá trị...'; textarea.setAttribute('aria-label', 'Nội dung cột ' + (count + 1));
                card.append(title, hint, textarea); $('joinFields').appendChild(card);
            }
            joinAdd(); joinAdd();
            $('joinAdd').onclick = joinAdd;
            $('joinRemove').onclick = () => { if ($('joinFields').children.length > 2) $('joinFields').lastElementChild.remove(); else toast('Cần ít nhất 2 cột.'); };
            document.querySelectorAll('[data-delim]').forEach(button => button.onclick = () => setTool('joinDelimiter', button.dataset.delim));
            toolAction('joinRun', 'joinOutput', () => {
                const cells = Array.from($('joinFields').querySelectorAll('.join-value')).map(input => toolLines(input.value, true));
                const length = cells.reduce((max, column) => Math.max(max, column.length), 0), delimiter = toolDelimiter('joinDelimiter', true);
                if (!length) throw Error('Nhập dữ liệu ít nhất một cột.');
                if (cells.some(column => column.length > 1 && column.length !== length)) throw Error('Các cột nhiều giá trị phải cùng số dòng, kể cả dòng trống.');
                const estimate = cells.reduce((total, column) => total + (column.length === 1 ? column[0].length * length : column.reduce((sum, value) => sum + value.length, 0)), 0) + length * ((cells.length - 1) * delimiter.length + 1);
                if (estimate > TOOL_MAX_OUTPUT) throw Error('Kết quả vượt 10 MB. Hãy chia nhỏ dữ liệu.');
                const output = Array.from({length}, (_, index) => cells.map(column => column.length === 1 ? column[0] : (column[index] ?? '')).join(delimiter)).join('\n');
                setTool('joinOutput', output); $('joinCount').textContent = `Đã ghép ${length} hàng · ${cells.length} cột.`;
            });
            function prepareSkin() {
                const rows = toolLines(toolVal('skinInput')), minimum = toolInteger('skinMin', 2, 20);
                let invalid = 0, headers = 0;
                const output = rows.filter((line, index) => {
                    if (index === 0 && $('skinSkipHeader').checked && /^(?:t[aà]i\s*kho[aả]n|taikhoan|username|tk)\s*\|\s*(?:mk|m[aậ]t\s*kh[aẩ]u|password|pass)\s*\|/i.test(line.trim())) { headers++; return false; }
                    const parts = line.split('|').map(value => value.trim());
                    const valid = parts.length >= minimum && parts.slice(0, minimum).every(value => value !== '');
                    if (!valid) invalid++;
                    return valid || !$('skinOnlyValid').checked;
                });
                const text = output.join('\n'); setTool('skinOutput', text);
                $('skinCount').textContent = `Đầu vào ${rows.length} dòng · Xuất ${output.length} · Thiếu trường ${invalid} · Bỏ tiêu đề ${headers}.`;
                return text;
            }
            toolAction('skinRun', 'skinOutput', prepareSkin);
            toolAction('skinDownload', 'skinOutput', () => {
                const text = prepareSkin(); if (!text) throw Error('Không có dữ liệu hợp lệ để tải.');
                const raw = toolVal('skinFilename').trim() || 'account-skin.txt';
                const name = raw.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'account-skin.txt';
                download(name.toLowerCase().endsWith('.txt') ? name : name + '.txt', text, 'text/plain;charset=utf-8');
            });
            document.querySelectorAll('[data-tool-file]').forEach(file => file.addEventListener('change', async () => {
                const item = file.files?.[0]; if (!item) return;
                const owner = currentUser?.id;
                try {
                    if (item.size > TOOL_MAX_INPUT) throw Error('Tệp TXT tối đa 5 MB.');
                    const text = await item.text(); if (owner !== currentUser?.id) return;
                    setTool(file.dataset.toolFile, text); toast('Đã nhập nội dung file TXT.');
                } catch (error) { toast(error.message || 'Không đọc được tệp.'); }
                finally { file.value = ''; }
            }));
            document.querySelectorAll('[data-tool-copy]').forEach(button => button.onclick = () => copyText(toolVal(button.dataset.toolCopy)));
            document.querySelectorAll('[data-tool-download]').forEach(button => button.onclick = () => {
                const value = toolVal(button.dataset.toolDownload); if (!value) { toast('Chưa có kết quả để tải.'); return; }
                download(button.dataset.toolDownload.replace(/Output$/, '').toLowerCase() + '-result.txt', value, 'text/plain;charset=utf-8');
            });
            // RFC 4648 Base32 and RFC 6238 SHA-1, 6 digits / 30 seconds.
            function base32Bytes(input) {
                const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                const text = String(input).toUpperCase().replace(/[\s-]/g, '');
                if (!/^[A-Z2-7]+={0,6}$/.test(text) || text.length > 4096) throw Error('Secret Base32 không hợp lệ. Chỉ dùng A–Z, 2–7 và dấu = ở cuối.');
                const source = text.replace(/=+$/, ''), remainder = source.length % 8;
                const padding = {0: 0, 2: 6, 4: 4, 5: 3, 7: 1};
                if (!(remainder in padding) || (text.includes('=') && text.length - source.length !== padding[remainder])) throw Error('Độ dài hoặc padding Base32 không hợp lệ.');
                let buffer = 0, bits = 0; const output = [];
                for (const char of source) {
                    buffer = (buffer << 5) | alphabet.indexOf(char); bits += 5;
                    if (bits >= 8) { bits -= 8; output.push((buffer >>> bits) & 255); }
                    buffer &= (1 << bits) - 1;
                }
                if (buffer !== 0 || !output.length) throw Error('Secret Base32 không hợp lệ (bit đệm khác 0).');
                return new Uint8Array(output);
            }
            let totpRequest = 0, lastTotpCounter = -1, activeTotpSecret = '', totpEnabled = false;
            function clearTotpDisplay() { $('totpCode').textContent = '------'; $('totpTimer').textContent = ''; }
            async function generateTotp() {
                const request = ++totpRequest, secret = toolVal('totpSecret');
                try {
                    if (!globalThis.crypto?.subtle) throw Error('Trình duyệt cần Web Crypto. Hãy mở bằng HTTPS, localhost hoặc file HTML trên Chrome.');
                    const bytes = base32Bytes(secret), counter = Math.floor(Date.now() / 30000), message = new Uint8Array(8);
                    let value = counter;
                    for (let index = 7; index >= 0; index--) { message[index] = value & 255; value = Math.floor(value / 256); }
                    const key = await crypto.subtle.importKey('raw', bytes, {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
                    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
                    if (request !== totpRequest || toolVal('totpSecret') !== secret) return;
                    if (counter !== Math.floor(Date.now() / 30000)) { generateTotp(); return; }
                    const offset = signature[signature.length - 1] & 15;
                    const number = ((signature[offset] & 127) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3];
                    $('totpCode').textContent = String(number % 1000000).padStart(6, '0');
                    $('totpTimer').textContent = `· còn ${30 - Math.floor(Date.now() / 1000 % 30)} giây`;
                    $('totpStatus').textContent = 'Mã 6 số · SHA-1 · thay đổi mỗi 30 giây. Đồng hồ thiết bị cần đúng giờ.';
                    lastTotpCounter = counter; activeTotpSecret = secret; totpEnabled = true;
                } catch (error) {
                    if (request !== totpRequest) return;
                    totpEnabled = false; clearTotpDisplay(); $('totpStatus').textContent = error.message || 'Không tạo được mã OTP.';
                }
            }
            $('totpGenerate').onclick = generateTotp;
            $('totpSecret').addEventListener('input', () => { totpRequest++; totpEnabled = false; activeTotpSecret = ''; clearTotpDisplay(); $('totpStatus').textContent = 'Bấm Tạo mã OTP để áp dụng secret mới.'; });
            $('totpClear').onclick = () => { totpRequest++; totpEnabled = false; activeTotpSecret = ''; lastTotpCounter = -1; setTool('totpSecret', ''); clearTotpDisplay(); $('totpStatus').textContent = ''; };
            const totpCopy = document.createElement('button'); totpCopy.id = 'totpCopy'; totpCopy.type = 'button'; totpCopy.className = 'btn'; totpCopy.textContent = 'Sao chép mã';
            totpCopy.onclick = () => {
                if (!totpEnabled || !/^\d{6}$/.test($('totpCode').textContent) || lastTotpCounter !== Math.floor(Date.now() / 30000) || activeTotpSecret !== toolVal('totpSecret')) { toast('Hãy tạo mã OTP hiện tại trước.'); return; }
                copyText($('totpCode').textContent);
            };
            $('totpClear').after(totpCopy);
            setInterval(() => {
                if ($('page-tool-2fa').classList.contains('hidden') || !totpEnabled || activeTotpSecret !== toolVal('totpSecret')) return;
                const counter = Math.floor(Date.now() / 30000);
                if (counter !== lastTotpCounter) { lastTotpCounter = counter; clearTotpDisplay(); generateTotp(); }
                else $('totpTimer').textContent = `· còn ${30 - Math.floor(Date.now() / 1000 % 30)} giây`;
            }, 1000);
