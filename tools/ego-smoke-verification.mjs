// Existing Ego Lite task space only. This does not open a different browser.
const task=await taskSpace(4),page=task.page('p2');
const fs=await import('node:fs/promises');
const log=[];const check=(name,actual)=>{log.push({name,pass:!!actual});if(!actual)throw Error(name)};
const registration=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.__QA_ERRORS__=[];addEventListener("error",e=>window.__QA_ERRORS__.push(e.message));addEventListener("unhandledrejection",e=>window.__QA_ERRORS__.push(String(e.reason)));'});
await page.reload();await page.waitForFunction(()=>!!window.__BANNER_DEBUG__);
for(const mode of ['tactical','heroic']){
 await page.click('button[data-mode="'+mode+'"]');
 const ids=await page.evaluate(()=>[...document.querySelectorAll('[data-battle]')].map(b=>Number(b.dataset.battle)));
 for(const id of ids){
  await page.click('button[data-battle="'+id+'"]');await page.click('button[data-action="launch"]');
  const s=await page.evaluate(()=>{const s=window.__BANNER_DEBUG__.getState();return {running:s.running,allies:s.allies,enemies:s.enemies,hp:s.hp,goal:s.objectiveStatus,units:s.soldiers.length};});
  check('전장 '+id+' 실제 출전과 목표 표시',s.running&&s.allies>0&&s.enemies>0&&s.hp>0&&s.goal?.label&&s.units>0);
  await page.keyboard.press('Escape');await page.click('button[data-action="return"]');
 }
}
await page.click('button[data-mode="tactical"]');await page.click('button[data-battle="1"]');await page.click('button[data-action="launch"]');
await page.click('button[aria-label="카메라 확대"]');const z1=await page.evaluate(()=>window.__BANNER_DEBUG__.getState().zoom);check('확대 버튼',z1>1);
await page.click('button[aria-label="카메라 축소"]');const z2=await page.evaluate(()=>window.__BANNER_DEBUG__.getState().zoom);check('축소 버튼',z2<z1);
await page.mouse.move(650,400);await page.mouse.wheel(0,-300);check('휠 확대',await page.evaluate(()=>window.__BANNER_DEBUG__.getState().zoom>1));
await page.keyboard.press('m');check('전술 지도',await page.evaluate(()=>window.__BANNER_DEBUG__.getState().mapMode));
await page.selectOption('#command-unit','left');await page.click('[data-order="hold"]');check('좌군 지휘',await page.evaluate(()=>{const s=window.__BANNER_DEBUG__.getState();return s.selectedUnit==='left'&&s.command==='hold'}));
await page.keyboard.press('Escape');const before=await page.evaluate(()=>window.__BANNER_DEBUG__.getState().time);await page.keyboard.press('q');check('일시정지 중 시간과 기술 정지',await page.evaluate(before=>{const s=window.__BANNER_DEBUG__.getState();return s.paused&&s.time===before&&s.cooldowns.q===0},before));
await page.click('button[data-action="return"]');check('지도 종료 후 사령부 복귀',await page.evaluate(()=>!document.querySelector('#app').classList.contains('map-mode')));
const errors=await page.evaluate(()=>window.__QA_ERRORS__||[]);check('자바스크립트 실행 오류 없음',errors.length===0);
await fs.writeFile('/Users/gyuha/workspace/c-rtc/docs/evidence/browser-smoke-checks.json',JSON.stringify({checks:log,errors},null,2));
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});
console.log({checks:log.length,passed:log.filter(x=>x.pass).length,errors});
console.log(await page.screenshot({path:'/Users/gyuha/workspace/c-rtc/docs/evidence/rebuilt-desktop.png'}));
