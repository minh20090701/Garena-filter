/* Browser regression checks. All external requests are blocked; no real account is used. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const url = 'http://localhost:8765/';
const results = [];
let browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true, ...options });
  await context.route(/^https?:\/\//, async route => {
    if (route.request().url() === url) return route.fulfill({ contentType: 'text/html', body: await fs.readFile(path.join(root, 'Garena_Filter_Pro_V4.html'), 'utf8') });
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url);
  if (!(await page.locator('#mainApp').isVisible())) await page.locator('#localModeBtn').click();
  await page.locator('#mainApp').waitFor({ state: 'visible' });
  return { context, page };
}
async function go(page, name) {
  const nav = page.locator(`.nav[data-page="${name}"]`);
  if (!(await nav.isVisible())) await page.locator('#mobileMenu').click();
  await nav.click();
  await page.locator(`#page-${name}`).waitFor({ state: 'visible' });
}
async function importText(page, text) {
  await go(page, 'dashboard');
  await page.locator('#clearFilter').click();
  await page.locator('#rawData').fill(text);
  await page.locator('#processBtn').click();
}
const total = async page => Number(await page.locator('#statTotal').innerText());
const rows = page => page.locator('#accountRows tr:has([data-select])');
const cells = async (page, index = 0) => rows(page).nth(index).locator('td').allTextContents();
async function download(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  const item = await event;
  return { name: item.suggestedFilename(), text: await fs.readFile(await item.path(), 'utf8') };
}
async function upload(page, selector, name, text) {
  await page.locator(selector).setInputFiles({ name, mimeType: name.endsWith('.json') ? 'application/json' : 'text/csv', buffer: Buffer.from(text) });
  await pause(120);
}
async function check(name, test, options) {
  if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) return;
  const started = Date.now();
  let state;
  try {
    state = await start(options);
    await test(state.page, state.context);
    assert.deepEqual(state.page.errors, [], 'No uncaught JavaScript errors');
    results.push({ name, status: 'PASS', ms: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message, ms: Date.now() - started });
    console.error(`FAIL ${name}: ${error.message}`);
    if (state) await state.page.screenshot({ path: path.join(root, 'screenshots', `failure-${results.length}.png`), fullPage: true }).catch(() => {});
  } finally {
    if (state) await state.context.close();
  }
}

(async () => {
  await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

  await check('Offline startup, every navigation page, help', async page => {
    assert.equal(await total(page), 0);
    const names = await page.locator('.nav[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page));
    assert.ok(names.length >= 20);
    for (const name of names) {
      await go(page, name);
      assert.equal(await page.locator('.content .page:visible').count(), 1, name);
    }
    await go(page, 'dashboard');
    await page.locator('#helpBtn').click();
    assert.equal(await page.locator('#helpDialog').isVisible(), true);
    await page.locator('#closeHelp').click();
    assert.equal(await page.locator('#helpDialog').isVisible(), false);
    await page.screenshot({ path: path.join(root, 'screenshots', 'desktop-empty.png'), fullPage: true });
  });

  await check('Plain/labeled import, status-only, UID and invalid records', async page => {
    await importText(page, [
      'basic|pw|Tên tiếng Việt|15',
      'blank|pw|Status : ACC TRẮNG',
      'wrongpass|pw|TÌNH TRẠNG : ACC TRẮNG LỖI PASS',
      'uidfull|pw|1234567890|UID Name|31|5|1|2|0|0||',
      '|missing-user',
      '||||',
      'not-a-record'
    ].join('\n'));
    assert.equal(await total(page), 4);
    assert.equal((await cells(page, 0))[4], 'Tên tiếng Việt');
    assert.equal((await cells(page, 1))[13], 'ACC TRẮNG');
    assert.equal((await cells(page, 2))[13], 'ACC TRẮNG LỖI PASS');
    assert.equal((await cells(page, 3))[3], '1234567890');
    assert.equal((await cells(page, 3))[12], '');
    assert.equal(await page.locator('#statBlank').innerText(), '1');
    assert.equal(await page.locator('#statBlankPass').innerText(), '1');
    await page.locator('#togglePassword').click();
    assert.equal((await cells(page))[2], 'pw');
    await page.screenshot({ path: path.join(root, 'screenshots', 'desktop-data.png'), fullPage: true });
  });

  await check('Quoted CSV multiline, BOM, header mapping, safe export roundtrip', async page => {
    const csv = '\uFEFFTK,MK,UID,NAME,LV,SKIN,SS,SSS,SKIN_HIEM,MYSTIC,MAIL,PHONE,STATUS,EXTRA\r\n"csv-user","p,ass","1234567890","Tên, có \"\"nháy\"\"\nDòng 2",30,8,1,2,3,4,"sample@example.com","0901234567","ACC FULL","extra,value"';
    await upload(page, '#importFile', 'quoted.csv', csv);
    assert.equal(await total(page), 1);
    let row = await cells(page);
    assert.equal(row[4], 'Tên, có "nháy"\nDòng 2');
    assert.equal(row[11], 'sample@example.com');
    assert.equal(row[12], '0901234567');
    assert.equal(row[13], 'ACC FULL');
    const result = await download(page, '#exportBtn');
    assert.ok(result.text.startsWith('\uFEFF'));
    await upload(page, '#importFile', 'roundtrip.csv', result.text);
    assert.equal(await total(page), 1);
    row = await cells(page);
    assert.equal(row[4], 'Tên, có "nháy"\nDòng 2');
    await page.locator('#togglePassword').click();
    assert.equal((await cells(page))[2], 'p,ass');
    await importText(page, '=SUM(1)|pw|Formula|10');
    const safe = await download(page, '#exportBtn');
    assert.ok(safe.text.includes("'=SUM(1)"), 'formula-like cells must be safe in spreadsheets');
  });

  await check('Import deduplication is explicit and append mode preserves data', async page => {
    await page.locator('#importDedupe').uncheck();
    await importText(page, 'a|pw\na|pw');
    assert.equal(await total(page), 2);
    assert.equal(await page.locator('#rawData').inputValue(), 'a|pw\na|pw', 'editor source must not be rewritten');
    await page.locator('#importDedupe').check();
    await importText(page, 'a|pw\na|pw');
    assert.equal(await total(page), 1);
    await page.locator('#importMode').selectOption('append');
    await importText(page, 'b|pw');
    assert.equal(await total(page), 2);
    assert.equal((await cells(page, 0))[1], 'a');
    assert.equal((await cells(page, 1))[1], 'b');
  });

  await check('Advanced skin and no-skin filters persist through rerender and paging', async page => {
    await importText(page, Array.from({ length: 26 }, (_, n) => {
      const i = n + 1;
      return `user${i}|pw|${100000 + i}|Name ${i}|${i}|${i % 2 ? 0 : i}|0|0|0|0||`;
    }).join('\n'));
    await go(page, 'filter');
    await page.locator('#advSkin').fill('5');
    await page.locator('#advancedApply').click();
    await go(page, 'dashboard');
    assert.ok((await page.locator('#countLabel').innerText()).includes('11'));
    assert.equal(await rows(page).count(), 10);
    await page.locator('#nextPage').click();
    assert.equal(await rows(page).count(), 1);
    await page.locator('#headerCheck').check();
    assert.equal(await rows(page).count(), 1);
    await page.locator('#clearFilter').click();
    assert.ok((await page.locator('#countLabel').innerText()).includes('26'));
    await go(page, 'filter');
    await page.locator('#advancedReset').click();
    await page.locator('#advStatus').selectOption('none');
    await page.locator('#advancedApply').click();
    await go(page, 'dashboard');
    assert.ok((await page.locator('#countLabel').innerText()).includes('13'));
    await page.locator('#togglePassword').click();
    assert.ok((await page.locator('#countLabel').innerText()).includes('13'));
  });

  await check('Selection, mixed header state, delete and undo', async page => {
    await importText(page, 'a|pw\nb|pw\nc|pw');
    await page.locator('#accountRows [data-select]').first().check();
    assert.equal(await page.locator('#headerCheck').evaluate(el => el.indeterminate), true);
    await page.locator('#deleteSelected').click();
    assert.equal(await total(page), 2);
    await page.locator('#undoBtn').click();
    assert.equal(await total(page), 3);
    await page.locator('#accountRows [data-delete]').first().click();
    assert.equal(await total(page), 2);
    await page.locator('#undoBtn').click();
    assert.equal(await total(page), 3);
  });

  await check('Named sets, backup restore, malformed backup remains atomic', async page => {
    await importText(page, 'a|pw|Tên A|10\nb|pw|Tên B|20');
    await page.locator('#setName').fill('Bộ kiểm thử');
    await page.locator('#saveSetBtn').click();
    const backup = await download(page, '#backupBtn');
    const payload = JSON.parse(backup.text);
    assert.equal(payload.accounts.length, 2);
    assert.equal(payload.sets['Bộ kiểm thử'].length, 2);
    await importText(page, 'replacement|pw');
    await page.locator('#savedSets').selectOption('Bộ kiểm thử');
    await page.locator('#loadSetBtn').click();
    assert.equal(await total(page), 2);
    await importText(page, 'replacement|pw');
    await upload(page, '#restoreFile', 'backup.json', backup.text);
    assert.equal(await total(page), 2);
    await upload(page, '#restoreFile', 'bad.json', JSON.stringify({ accounts: [null], sets: {} }));
    assert.equal(await total(page), 2, 'reject invalid snapshot without partial replacement');
    await upload(page, '#restoreFile', 'xss.json', JSON.stringify({ accounts: [{ tk: '<img src=x onerror=alert(1)>', mk: 'pw', lv: '<img src=x onerror=alert(1)>', declaredStatus: '<svg onload=alert(1)>' }], sets: {} }));
    assert.equal(await page.locator('#accountRows img, #accountRows svg').count(), 0);
  });

  await check('Local auto save switch and theme survive reload', async page => {
    await importText(page, 'saved|pw');
    await pause(800);
    await page.reload();
    await page.locator('#mainApp').waitFor({ state: 'visible' });
    assert.equal(await total(page), 1);
    assert.equal((await cells(page))[1], 'saved');
    await page.locator('#autoSave').uncheck();
    await importText(page, 'unsaved|pw');
    await pause(800);
    await page.reload();
    await page.locator('#mainApp').waitFor({ state: 'visible' });
    assert.equal((await cells(page))[1], 'saved');
    assert.equal(await page.locator('#autoSave').isChecked(), false);
    const before = await page.locator('body').evaluate(el => el.classList.contains('dark'));
    await page.locator('#topTheme').click();
    await page.reload();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dark')), !before);
  });

  await check('Text tools: sequences, natural sort, split and literal replace', async page => {
    await go(page, 'tool-sequence');
    await page.locator('#seqBase').fill('acc');
    await page.locator('#seqStart').fill('0');
    await page.locator('#seqEnd').fill('2');
    await page.locator('#seqRun').click();
    assert.equal(await page.locator('#seqOutput').inputValue(), 'acc0\nacc1\nacc2');
    await page.locator('#seqEnd').fill('20001');
    await page.locator('#seqRun').click();
    assert.notEqual((await page.locator('#seqOutput').inputValue()).split('\n').length, 20002);
    await go(page, 'tool-sort');
    await page.locator('#sortInput').fill('acc10|p\nacc2|p\nacc1|p\nplain|p');
    await page.locator('#sortRun').click();
    assert.equal(await page.locator('#sortOutput').inputValue(), 'acc1|p\nacc2|p\nacc10|p\nplain|p');
    await go(page, 'tool-split');
    await page.locator('#splitInput').fill('a|b|c\nd||f');
    await page.locator('#splitDelimiter').fill('|');
    await page.locator('#splitMode').selectOption('number');
    await page.locator('#splitColumn').fill('2');
    await page.locator('#splitRun').click();
    assert.equal(await page.locator('#splitOutput').inputValue(), 'b\n');
    await go(page, 'tool-replace');
    await page.locator('#replaceInput').fill('a a');
    await page.locator('#replaceFind').fill('a');
    await page.locator('#replaceWith').fill('$&');
    await page.locator('#replaceAll').check();
    await page.locator('#replaceRun').click();
    assert.equal(await page.locator('#replaceOutput').inputValue(), '$& $&');
  });

  await check('Text tools: dedupe, missing, auth merge, positional join, skin file', async page => {
    await go(page, 'tool-dedupe');
    await page.locator('#dedupeInput').fill('a|1\na|1\nb|2');
    await page.locator('#dedupeRun').click();
    assert.equal(await page.locator('#dedupeOutput').inputValue(), 'a|1\nb|2');
    await go(page, 'tool-missing');
    await page.locator('#missingInput').fill('a|1\nb|\nc');
    await page.locator('#missingDelimiter').fill('|');
    await page.locator('#missingMin').fill('2');
    await page.locator('#missingRun').click();
    assert.equal(await page.locator('#missingOutput').inputValue(), 'b|\nc');
    await go(page, 'tool-authen-merge');
    await page.locator('#authBase').fill('Alice|pw\nBob|pw');
    await page.locator('#authSource').fill('alice|SECRET\nbob|OTHER');
    await page.locator('#authDelimiter').fill('|');
    await page.locator('#authColumn').selectOption('last');
    await page.locator('#authRun').click();
    assert.equal(await page.locator('#authOutput').inputValue(), 'Alice|pw|SECRET\nBob|pw|OTHER');
    await go(page, 'tool-join');
    await page.locator('.join-value').nth(0).fill('a\n\nc');
    await page.locator('.join-value').nth(1).fill('1\n2\n3');
    await page.locator('#joinDelimiter').fill('|');
    await page.locator('#joinRun').click();
    assert.equal(await page.locator('#joinOutput').inputValue(), 'a|1\n|2\nc|3');
    await go(page, 'tool-skin-file');
    await page.locator('#skinInput').fill('a|b|c|d|e|f\nbroken|row');
    await page.locator('#skinMin').fill('6');
    await page.locator('#skinOnlyValid').check();
    await page.locator('#skinRun').click();
    assert.equal(await page.locator('#skinOutput').inputValue(), 'a|b|c|d|e|f');
  });

  await check('TOTP RFC vector, clear and invalid secret', async page => {
    await go(page, 'tool-2fa');
    await page.evaluate(() => { Date.now = () => 59000; });
    await page.locator('#totpSecret').fill('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    await page.locator('#totpGenerate').click();
    await page.waitForFunction(() => document.getElementById('totpCode').textContent === '287082');
    await page.locator('#totpClear').click();
    assert.equal(await page.locator('#totpCode').innerText(), '------');
    assert.equal(await page.locator('#totpSecret').inputValue(), '');
    await page.locator('#totpSecret').fill('!!!!');
    await page.locator('#totpGenerate').click();
    assert.equal(await page.locator('#totpCode').innerText(), '------');
    assert.ok((await page.locator('#totpStatus').innerText()).length > 0);
  });

  await check('Mobile layout and navigation, light and dark', async page => {
    const checkWidth = async name => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No viewport overflow: ${name}`);
    await checkWidth('dashboard');
    await page.screenshot({ path: path.join(root, 'screenshots', 'mobile-light.png'), fullPage: true });
    const names = await page.locator('.nav[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page));
    for (const name of names) {
      await go(page, name);
      await checkWidth(name);
    }
    await go(page, 'dashboard');
    await page.locator('#topTheme').click();
    await checkWidth('dark dashboard');
    await page.screenshot({ path: path.join(root, 'screenshots', 'mobile-dark.png'), fullPage: true });
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await browser.close();
  const report = { passed: results.filter(x => x.status === 'PASS').length, failed: results.filter(x => x.status === 'FAIL').length, results };
  await fs.writeFile(path.join(root, 'tests', process.env.TEST_FILTER ? 'browser-targeted-results.json' : 'browser-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exitCode = 1; });
