/* Targeted browser regressions. Local HTML is routed without a server; no external service is contacted. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const url = 'http://localhost:8765/';
const results = [];
let browser;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const rows = page => page.locator('#accountRows tr:has([data-select])');
const total = async page => Number(await page.locator('#statTotal').innerText());
async function go(page, name) { await page.locator(`.nav[data-page="${name}"]`).click(); }
async function importText(page, text) {
  await go(page, 'dashboard');
  await page.locator('#clearFilter').click();
  await page.locator('#rawData').fill(text);
  await page.locator('#processBtn').click();
}
async function upload(page, data) {
  await page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await wait(100);
}
async function downloaded(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  return fs.readFile(await (await event).path(), 'utf8');
}
async function check(name, test) {
  if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) return;
  const began = Date.now();
  const context = await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true});
  const external = [];
  await context.route(/^https?:\/\//, async route => {
    if(route.request().url()===url) return route.fulfill({contentType:'text/html',body:await fs.readFile(path.join(root,'Garena_Filter_Pro_V4.html'),'utf8')});
    if(!route.request().url().startsWith('http://localhost:8765/')) external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto(url);
    await page.locator('#mainApp').waitFor({state:'visible'});
    await test(page, external);
    assert.deepEqual(errors, [], 'No uncaught browser exceptions');
    results.push({name,status:'PASS',ms:Date.now()-began});
    console.log(`PASS ${name}`);
  } catch(error) {
    results.push({name,status:'FAIL',error:error.message.slice(0,700),ms:Date.now()-began});
    console.error(`FAIL ${name}: ${error.message.slice(0,700)}`);
  } finally { await context.close(); }
}
(async()=>{
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});

  await check('Local startup and local tools make zero external requests', async (page, external) => {
    await wait(250);
    await importText(page,'offline|password|Offline|1');
    await go(page,'tool-join');
    await go(page,'tool-outlook');
    await go(page,'tool-mail-code');
    await wait(100);
    assert.deepEqual(external,[]);
    assert.equal(await page.locator('script[src]').count(),0,'SDKs should be loaded only after cloud connection is requested');
  });

  await check('Navigation search truly hides unmatched tools and handles accents',async page=>{
    const all=await page.locator('.nav[data-page]').count();
    await page.locator('#navSearch').fill('ghep');
    const visible=await page.locator('.nav[data-page]:visible').allTextContents();
    assert.ok(visible.length>0&&visible.length<all);
    assert.ok(visible.every(text=>text.toLowerCase().includes('ghép')));
    assert.equal(await page.locator('.nav[data-page="dashboard"]').isVisible(),false);
    await page.locator('#navSearch').fill('no-match-12345');
    assert.equal(await page.locator('.nav[data-page]:visible').count(),0);
    await page.locator('#navSearch').fill('');
    assert.equal(await page.locator('.nav[data-page]:visible').count(),all);
  });

  await check('Clipboard absent and rejected fall back without losing selection or lying about failure', async page=>{
    await importText(page,'clipboard|pw');
    await page.evaluate(()=>{
      window.copyValues=[];
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
      document.execCommand=command=>{if(command==='copy')window.copyValues.push(document.activeElement.value);return true;};
    });
    await page.locator('[data-format="tkmk"]').click();
    assert.deepEqual(await page.evaluate(()=>window.copyValues),['clipboard|pw']);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.format),'tkmk');
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('permission denied');}}}));
    await page.locator('[data-format="tk"]').click();
    assert.deepEqual(await page.evaluate(()=>window.copyValues),['clipboard|pw','clipboard']);
    await page.evaluate(()=>{document.execCommand=()=>false;});
    await page.locator('[data-format="tk"]').click();
    assert.match(await page.locator('#toast').innerText(),/Không sao chép được/);
  });

  await check('Malformed quoted CSV import is atomic and does not corrupt undo',async page=>{
    await importText(page,'keep|pw|Original|10');
    for(const broken of ['TK,MK,NAME\n"bad","pw","unclosed','TK,MK\n"bad"garbage,"pw"']){
      await page.locator('#rawData').fill(broken);
      await page.locator('#processBtn').click();
      assert.equal(await total(page),1);
      assert.equal(await rows(page).first().locator('td').nth(1).innerText(),'keep');
      assert.match(await page.locator('#toast').innerText(),/CSV/);
    }
    await page.locator('#undoBtn').click();
    assert.equal(await total(page),0,'invalid imports should not push undo snapshots');
  });

  await check('Duplicate backup IDs become independent records',async page=>{
    await upload(page,{accounts:[{id:'duplicate',tk:'one',mk:'pw'},{id:'duplicate',tk:'two',mk:'pw'},{tk:'three',mk:'pw'}],sets:{}});
    assert.equal(await total(page),3);
    const ids=await page.locator('#accountRows [data-select]').evaluateAll(nodes=>nodes.map(node=>node.dataset.select));
    assert.equal(new Set(ids).size,3);
    await page.locator('#accountRows [data-select]').first().check();
    assert.equal(await page.locator('#accountRows [data-select]:checked').count(),1);
    await page.locator('#deleteSelected').click();
    assert.equal(await total(page),2);
    assert.equal(await rows(page).first().locator('td').nth(1).innerText(),'two');
  });

  await check('Legacy headerless extra columns survive import, full copy and CSV roundtrip',async page=>{
    await importText(page,'legacy|pw|123|Name|10|1|0|0|0|0|||note-13|note-14');
    let snapshot=JSON.parse(await downloaded(page,'#backupBtn'));
    assert.equal(snapshot.accounts[0].extra,'note-13|note-14');
    assert.equal(snapshot.accounts[0].declaredStatus,'');
    const csv=await downloaded(page,'#exportBtn');
    await page.locator('#importFile').setInputFiles({name:'roundtrip.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await wait(100);
    snapshot=JSON.parse(await downloaded(page,'#backupBtn'));
    assert.equal(snapshot.accounts[0].extra,'note-13|note-14');
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copied=value;}}});});
    await page.locator('[data-format="full"]').click();
    const full=await page.evaluate(()=>window.copied);
    await importText(page,full);
    snapshot=JSON.parse(await downloaded(page,'#backupBtn'));
    assert.equal(snapshot.accounts[0].extra,'note-13|note-14');
  });

  await check('Restored HTML-looking data and dataset names remain escaped text',async page=>{
    const payload='<img src=x onerror="window.xssRan=1">';
    const data={accounts:[{tk:payload,mk:'pw',name:'<svg onload="window.xssRan=2"></svg>',lv:1,declaredStatus:'<svg onload=alert(1)>'}],sets:{[payload]:[]}};
    await upload(page,data);
    assert.equal(await total(page),1);
    assert.equal(await rows(page).first().locator('td').nth(1).innerText(),payload);
    assert.equal(await page.locator('#accountRows img, #accountRows svg').count(),0);
    await go(page,'saves');
    assert.equal(await page.locator('#setsList img, #setsList svg').count(),0);
    assert.ok((await page.locator('#setsList').innerText()).includes(payload));
    assert.equal(await page.evaluate(()=>window.xssRan),undefined);
  });

  await check('10,000 rows import and subsequent filtering remain usable',async page=>{
    const text=Array.from({length:10000},(_,i)=>`large${i}|pw|Name ${i}|${i%100}`).join('\n');
    await page.locator('#autoSave').uncheck();
    console.log('Large input readiness:', await page.locator('#rawData').evaluate(el=>({visible:!!el.getClientRects().length,disabled:el.disabled,hidden:el.closest('.hidden')?.id})));
    const began=Date.now();
    await page.locator('#importFile').setInputFiles({name:'large.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
    await page.waitForFunction(()=>document.getElementById('statTotal').textContent==='10000');
    assert.equal(await total(page),10000);
    assert.ok(Date.now()-began<8000,'10k import should finish within 8 seconds');
    assert.equal(await rows(page).count(),10,'table is paginated rather than rendering 10k DOM rows');
    const searchStart=Date.now();
    await page.locator('#searchBox').fill('large9999');
    assert.equal(await rows(page).count(),1);
    assert.equal(await rows(page).first().locator('td').nth(1).innerText(),'large9999');
    assert.ok(Date.now()-searchStart<3000,'search remains responsive');
  });

  await check('Selection across pages and filters remains explicit on copy/delete pages',async page=>{
    await importText(page,Array.from({length:12},(_,i)=>`acc${i}|pw`).join('\n'));
    await page.locator('#accountRows [data-select]').first().check();
    await page.locator('#nextPage').click();
    await page.locator('#accountRows [data-select]').last().check();
    await page.locator('#searchBox').fill('acc5');
    assert.match(await page.locator('#selectionCount').innerText(),/2/);
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copied=value;}}});});
    await go(page,'copy');
    await page.locator('#copyPageTk').click();
    assert.equal(await page.evaluate(()=>window.copied),'acc0\nacc11');
    await go(page,'delete');
    assert.equal(await page.locator('#deletePageCount').innerText(),'2');
    await page.locator('#deletePageConfirm').click();
    await go(page,'dashboard');
    assert.equal(await total(page),10);
    assert.equal(await rows(page).count(),1,'active filter is retained');
    await page.locator('#undoBtn').click();
    assert.equal(await total(page),12);
  });

  await check('Pending TOTP cannot reappear after clearing secret; expired copy is rejected',async page=>{
    await go(page,'tool-2fa');
    await page.evaluate(()=>{
      window.totpTime=59000;Date.now=()=>window.totpTime;
      window.realSign=crypto.subtle.sign.bind(crypto.subtle);
      crypto.subtle.sign=(...args)=>new Promise(resolve=>{window.releaseSign=async()=>resolve(await window.realSign(...args));});
    });
    await page.locator('#totpSecret').fill('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    await page.locator('#totpGenerate').click();
    await page.waitForFunction(()=>typeof window.releaseSign==='function');
    await page.locator('#totpClear').click();
    await page.evaluate(()=>window.releaseSign());
    await wait(80);
    assert.equal(await page.locator('#totpCode').innerText(),'------');
    assert.equal(await page.locator('#totpSecret').inputValue(),'');
    await page.evaluate(()=>{crypto.subtle.sign=window.realSign;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copied=value;}}});});
    await page.locator('#totpSecret').fill('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    await page.locator('#totpGenerate').click();
    await page.waitForFunction(()=>document.getElementById('totpCode').textContent==='287082');
    await go(page,'dashboard');
    await page.evaluate(()=>{window.totpTime=60000;document.getElementById('totpCopy').click();});
    assert.equal(await page.evaluate(()=>window.copied),undefined);
    assert.match(await page.locator('#toast').innerText(),/mã OTP hiện tại/);
  });

  await browser.close();
  const report={passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results};
  await fs.writeFile(path.join(root,'tests',process.env.TEST_FILTER ? 'edge-targeted-results.json' : 'edge-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
  process.exitCode=report.failed?1:0;
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});
