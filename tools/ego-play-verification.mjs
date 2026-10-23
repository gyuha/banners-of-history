// Run through Ego Lite only: ego-browser nodejs < /absolute/path/tools/ego-play-verification.mjs
// This uses real UI inputs and read-only debug state, never edits combat state.
const task = await taskSpace(4);
const page = task.page('p2');
const fs = await import('node:fs/promises');
const log=[];
console.log(await page.evaluate(()=>({running:window.__BANNER_DEBUG__.getState().running,modal:!!document.querySelector('[role="dialog"]')})));
await page.reload();
await page.waitForFunction(()=>!!window.__BANNER_DEBUG__);
await page.click('#weapon-open');
await page.click('button[data-weapon="bow"]');
await page.click('button[aria-label="닫기"]');
await page.click('button[data-mode="heroic"]');
await page.click('button[data-battle="20"]');
await page.click('button[data-action="launch"]');
await page.click('button[data-action="speed"]');
await page.click('button[data-action="speed"]');
await page.mouse.move(650,480);
await page.mouse.down({button:'left'});
const pressed=new Set();
const start=Date.now();
let turns=0;
while(Date.now()-start<35000){
 const s=await page.evaluate(()=>window.__BANNER_DEBUG__.getState());
 if(!s.running){log.push({time:s.time,result:s.result,hp:s.hp,kills:s.kills,enemies:s.enemies,objective:s.objectiveStatus});break;}
 const enemies=s.soldiers.filter(u=>u.team===2);
 const nearest=enemies.sort((a,b)=>Math.hypot(a.x-s.hero.x,a.z-s.hero.z)-Math.hypot(b.x-s.hero.x,b.z-s.hero.z))[0];
 const desired=new Set();
 if(nearest){const dx=nearest.x-s.hero.x,dz=nearest.z-s.hero.z,d=Math.hypot(dx,dz);if(d>8){const sx=dx*Math.cos(.6)-dz*Math.sin(.6),sz=dx*Math.sin(.6)+dz*Math.cos(.6);if(Math.abs(sx)>d*.24)desired.add(sx>0?'d':'a');if(Math.abs(sz)>d*.24)desired.add(sz>0?'s':'w');}
  if(s.rage>=100&&d<27)await page.keyboard.press('t');
  if(s.cooldowns.e<=0&&d<14)await page.keyboard.press('e');
  if(s.cooldowns.q<=0&&d<11)await page.keyboard.press('q');
 }
 if(s.hp<s.maxHp*.8&&s.cooldowns.r<=0)await page.keyboard.press('r');
 for(const k of pressed)if(!desired.has(k)){await page.keyboard.up(k);pressed.delete(k);}
 for(const k of desired)if(!pressed.has(k)){await page.keyboard.down(k);pressed.add(k);}
 if(turns++%20===0)log.push({time:s.time,hp:s.hp,kills:s.kills,allies:s.allies,enemies:s.enemies,rage:s.rage,event:s.cameraEvent,fps:s.fps});
 await new Promise(r=>setTimeout(r,100));
}
for(const k of pressed)await page.keyboard.up(k);
await page.mouse.up({button:'left'});
const final=await page.evaluate(()=>window.__BANNER_DEBUG__.getState());
console.log({final:{time:final.time,hp:final.hp,kills:final.kills,enemies:final.enemies,result:final.result,objective:final.objectiveStatus}});
await fs.writeFile('/Users/gyuha/workspace/c-rtc/docs/evidence/browser-playthrough.json',JSON.stringify(log,null,2));
if(final.result){await page.waitForSelector('[role="dialog"]',{state:'visible'});console.log(await page.screenshot({path:'/Users/gyuha/workspace/c-rtc/docs/evidence/rebuilt-result.png'}));}
else{await page.keyboard.press('Escape');console.log((await page.snapshot()).slice(-200));}
