const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/mail.js'), 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const failures = []; page.on('pageerror', e => failures.push(e.message));
    const buttons = ['msConnect','msOtpConnect','msRefresh','msOtpRefresh','msMoreMail','msCopyRedirect','msSignOut','msOpenOtp','msOtpConfig','logoutBtn'];
    const fields = ['msClientId','msRedirectUri','msMailSearch','msOtpSearch','msMailCount','msOtpTime'];
    const blocks = ['msMailNotice','msOtpNotice','msMailStatus','msOtpStatus','msMailList','msMailDetail','msOtpResults'];
    await page.route('http://localhost/mail-test', route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><body>'+buttons.map(id=>`<button id="${id}">${id}</button>`).join('')+fields.map(id=>`<input id="${id}">`).join('')+blocks.map(id=>`<div id="${id}"></div>`).join('')+'</body></html>'}));
    await page.goto('http://localhost/mail-test');
    await page.addScriptTag({content:`
      window.calls = []; window.pending = []; window.mode = 'normal';
      window.account = {homeAccountId:'account-A', username:'a@example.test'};
      window.msal = {PublicClientApplication: class {
        async handleRedirectPromise(){return null;} getAllAccounts(){return [];} setActiveAccount(){}
        async loginPopup(){if(window.mode === 'cancel') throw {errorCode:'user_cancelled', message:'Đã hủy'}; if(window.mode === 'waitLogin') return new Promise(r=>window.finishLogin=r); return {account:window.account};}
        async loginRedirect(){window.redirected=true;}
        async acquireTokenSilent(){window.calls.push('token'); return {account:window.account, accessToken:'mock-token'};}
        async logoutPopup(){window.calls.push('logout');}
      }};
      window.fetch = (url, options) => {window.calls.push(url);return new Promise(resolve=>window.pending.push({url,resolve}));};
      window.resolveRequest = (index, data, status=200) => {const req=window.pending.splice(index,1)[0];req.resolve({ok:status===200,status,json:async()=>data});};
    `});
    await page.addScriptTag({content:source.replace(/\}\)\(\);\s*$/, 'window.__mailTest={codeCandidates,graph,resetConnection};\n})();')});
    await page.fill('#msClientId', 'bad-guid'); await page.click('#msConnect');
    await page.waitForFunction(()=>document.getElementById('msMailNotice').textContent.includes('không hợp lệ'));
    const codes = await page.evaluate(()=>window.__mailTest.codeCandidates('mã123456 123456789 abc1234x 1234 1234 654321 87654321'));
    assert.deepEqual(codes, ['1234','654321','87654321']);
    await page.fill('#msClientId', '11111111-2222-3333-4444-555555555555');
    await page.click('#msConnect'); await page.waitForFunction(()=>window.pending.length===1);
    await page.evaluate(()=>window.resolveRequest(0,{value:[
      {id:'A',subject:'Verification code 246810',from:{emailAddress:{address:'sender@example.test'}},bodyPreview:'Your code is 246810.',receivedDateTime:new Date().toISOString()},
      {id:'B',subject:'Security code',bodyPreview:'Open the full message.',receivedDateTime:new Date().toISOString()}
    ],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=2'}));
    await page.waitForFunction(()=>document.querySelectorAll('.mail-list-item').length===2);
    assert.match(await page.textContent('#msOtpResults'), /246810/);
    assert.equal(await page.isDisabled('#msMoreMail'), false);
    const before = await page.evaluate(()=>window.calls.length);
    assert.equal(await page.evaluate(async()=>{try{await window.__mailTest.graph('https://evil.example/v1.0/me/messages');return false}catch{return true}}),true);
    assert.equal(await page.evaluate(()=>window.calls.length),before);
    await page.locator('.mail-list-item').nth(0).click();
    await page.locator('.mail-list-item').nth(1).click();
    await page.waitForFunction(()=>window.pending.length===2);
    await page.evaluate(()=>window.resolveRequest(1,{id:'B',subject:'New selection',body:{contentType:'text',content:'B detail'}}));
    await page.evaluate(()=>window.resolveRequest(0,{id:'A',subject:'Old selection',body:{contentType:'text',content:'A detail'}}));
    await page.waitForFunction(()=>document.getElementById('msMailDetail').textContent.includes('B detail'));
    assert.doesNotMatch(await page.textContent('#msMailDetail'),/A detail/);
    await page.click('#msMoreMail'); await page.waitForFunction(()=>window.pending.length===1);
    await page.evaluate(()=>window.resolveRequest(0,{error:{message:'Too many'}},429));
    await page.waitForFunction(()=>!document.getElementById('msMoreMail').disabled);
    assert.match(await page.textContent('#msMailNotice'), /429/);
    await page.click('#msMoreMail'); await page.waitForFunction(()=>window.pending.length===1);
    await page.evaluate(()=>window.resolveRequest(0,{value:[{id:'B',subject:'duplicate'},{id:'C',subject:'new message'}]}));
    await page.waitForFunction(()=>document.querySelectorAll('.mail-list-item').length===3);
    assert.equal(await page.isDisabled('#msMoreMail'),true);
    await page.click('#msRefresh'); await page.waitForFunction(()=>window.pending.length===1);
    await page.click('#msSignOut');
    await page.evaluate(()=>window.resolveRequest(0,{value:[{id:'old',subject:'Private stale mail'}]}));
    await page.waitForTimeout(30);
    assert.doesNotMatch(await page.textContent('#msMailList'),/Private stale mail/);
    assert.equal(await page.textContent('#msMailStatus'),'Chưa kết nối');
    await page.evaluate(()=>window.mode='cancel'); await page.click('#msConnect');
    await page.waitForFunction(()=>!document.getElementById('msConnect').disabled);
    assert.equal(await page.evaluate(()=>!!window.redirected),false);
    await page.evaluate(()=>window.mode='waitLogin'); await page.click('#msConnect');
    await page.waitForFunction(()=>typeof window.finishLogin==='function');
    await page.fill('#msClientId','aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    await page.evaluate(()=>window.finishLogin({account:window.account}));
    await page.waitForTimeout(30);
    assert.equal(await page.textContent('#msMailStatus'),'Chưa kết nối');
    assert.equal(await page.isDisabled('#msConnect'),false);
    assert.deepEqual(failures,[]);
    console.log('PASS: Microsoft mail validation, OTP boundaries, Graph origin, response races, pagination retries, sign-out races, and cancelled login.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
