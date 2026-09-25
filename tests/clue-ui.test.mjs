/** Browser regression suite for the redesigned second screen and its route boundaries. */
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require('/Users/ashutoshchatterjee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const browser=await playwright.chromium.launch({headless:true,channel:process.env.AIRFRAME_BROWSER_CHANNEL||'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
page.setDefaultTimeout(20000);
const base=process.env.AIRFRAME_TEST_URL||'http://127.0.0.1:4173';
const results=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir('test-results/clue-workspace',{recursive:true});
async function test(name,run){try{await run();results.push({name,status:'passed'});console.log('PASS',name);}catch(error){results.push({name,status:'failed',message:error.message});console.error('FAIL',name,error.message);await page.screenshot({path:`test-results/clue-workspace/failure-${results.length}.png`,fullPage:true});}}
async function ready(){await page.locator('.cw-matrix').waitFor();}
async function closeDetails(){await page.getByRole('button',{name:'Close diagnostic details',exact:true}).click();}
async function exportPacket(){
  await page.locator('[data-clue-export-open]').first().click();
  const wait=page.waitForEvent('download');
  await page.locator('[data-clue-download]').click();
  const download=await wait;
  const packet=JSON.parse(await readFile(await download.path(),'utf8'));
  await closeDetails();return packet;
}
await test('Factory still opens its original overview and investigation route',async()=>{
  await page.goto(base+'/#factory');await page.locator('.factory-view').waitFor();
  assert.ok(await page.locator('[data-select]').count()>0);
  await page.locator('[data-open="AF-104"]').last().click();await ready();
  assert.match(await page.locator('.cw-heading').innerText(),/Follow the clues/);
  assert.ok(await page.locator('.cw-matrix-row').count()>1);
  await page.screenshot({path:'test-results/clue-workspace/desktop.png',fullPage:true});
});
await test('AP focus retains other rows and pivots use the same shared window',async()=>{
  const originalWindow=await page.locator('.cw-window-title').innerText();
  const rowCount=await page.locator('.cw-matrix-row').count();
  await page.locator('[data-clue-focus-row]').last().click();
  assert.equal(await page.locator('.cw-matrix-row').count(),rowCount);
  for(const pivot of ['channel','client','source','ap']){
    await page.locator(`[data-clue-pivot="${pivot}"]`).click();
    assert.equal(await page.locator(`[data-clue-pivot="${pivot}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.cw-window-title').innerText(),originalWindow);
    assert.ok(await page.locator('.cw-matrix-row').count()>0);
  }
  await page.locator('[data-clue-clear-focus]').click();
});
await test('A heatmap cell opens exact members and original frame provenance',async()=>{
  await page.locator('[data-clue-metric]').selectOption('terminations');
  await page.locator('.cw-cell:not(.is-unknown)').filter({hasText:/^[1-9]/}).first().click();
  assert.match(await page.locator('.cw-cell-detail').innerText(),/observed|records|matching/i);
  await page.locator('.cw-cell-detail [data-clue-evidence]').click();
  const frame=page.locator('[data-clue-source-frame]').first();const id=await frame.getAttribute('data-clue-source-frame');
  await frame.click();assert.match(await page.locator('#frame-body').innerText(),new RegExp(id));
  assert.match(await page.locator('#frame-body').innerText(),/Capture SHA-256/);
  await page.getByRole('button',{name:'Close frame details',exact:true}).click();
});
await test('Metric and time selections propagate into an honest AI snapshot',async()=>{
  await page.locator('[data-clue-metric]').selectOption('retry_share');
  await page.locator('[data-clue-window-preset="last"]').click();
  const packet=await exportPacket();
  assert.equal(packet.scope.metric,'retry_share');
  assert.ok(packet.window.endUs-packet.window.startUs<=300_000_000);
  assert.ok(packet.metricDefinitions.some(item=>item.id==='retry_share'));
  assert.equal(packet.transport.modelCallMade,false);
  assert.ok(packet.evidence.resolution.projectionSha256);
  assert.ok(packet.unknowns.length>0);
  assert.doesNotMatch(JSON.stringify(packet),/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i);
});
await test('Coverage keeps unknown radio, source and service measurements visible',async()=>{
  await page.locator('[data-clue-coverage]').first().click();
  const content=await page.locator('#frame-body').innerText();
  assert.match(content,/Sensor health/i);assert.match(content,/unavailable/i);assert.match(content,/Application recovery/i);
  await closeDetails();
});
await test('Backward replay exports no later sample evidence',async()=>{
  await page.locator('[data-clue-window-preset="all"]').click();
  await page.locator('#mode-toggle').click();
  await page.locator('.cw-title-row').getByText('Recorded replay',{exact:true}).waitFor();
  const packet=await exportPacket();
  assert.equal(packet.context.mode,'capture_replay');
  assert.ok(packet.evidence.samples.every(row=>row.timeUs<=packet.context.cutoffUs));
  assert.ok(packet.window.endUs<=packet.context.cutoffUs);
  await page.locator('#mode-toggle').click();await ready();
});
await test('Original action brief remains incident scoped and returns to the new screen',async()=>{
  await page.locator('[data-clue-original-brief]').click();await page.locator('.action-view').waitFor();
  assert.match(await page.locator('.ws-action-breadcrumb').innerText(),/AF-104/);
  await page.getByRole('button',{name:'Close action brief',exact:true}).click();await ready();
});
await test('Narrow layout and matrix keyboard navigation remain usable',async()=>{
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const cell=page.locator('[data-clue-cell][tabindex="0"]');await cell.focus();await page.keyboard.press('ArrowRight');
  assert.ok(await page.locator('[data-clue-cell]').evaluateAll(nodes=>nodes.includes(document.activeElement)));
  const unnamed=await page.locator('button,input,select,textarea').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().width&&!node.disabled&&!((node.getAttribute('aria-label')||node.textContent||'').trim()||node.labels?.length)).map(node=>node.outerHTML.slice(0,100)));
  assert.deepEqual(unnamed,[]);
  await page.screenshot({path:'test-results/clue-workspace/mobile.png',fullPage:true});
});
await test('No browser runtime exceptions',async()=>assert.deepEqual(errors,[]));
await writeFile('test-results/clue-workspace/ui-report.json',JSON.stringify({results,errors},null,2));
await browser.close();
if(results.some(result=>result.status==='failed'))process.exitCode=1;
