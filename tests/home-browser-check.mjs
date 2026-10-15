async page => {
  const assert=(value,message) => { if (!value) throw new Error(message); };
  await page.waitForFunction(() => window.demo?.home?.ready);
  assert(await page.locator("room-outlet-card").count()===7,"Every native outlet section is one combined card");
  assert(await page.evaluate(() => window.demo.home.results.every(view => view.sections.every(section => section.cards.length===1 && section.cards[0].type==="custom:room-outlet-card"))),"Native switch/power/energy tiles are not left alongside the custom card");
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Home generation is passive");
  assert(await page.evaluate(() => window.demo.home.reads.length)===1,"Home settings read once per connection");
  assert(await page.evaluate(() => window.roomOutletCardHome.history.reduce((sum,entry) => sum+(entry.replaced || 0),0))===7,"Diagnostics confirm seven replacements");
  const build=await page.evaluate(() => performance.getEntriesByType("resource").find(entry => new URL(entry.name).searchParams.has("home-build"))?.name);
  assert(Boolean(build),"Global bootstrap loads a fresh installed bundle URL");
  assert(await page.evaluate(async () => {
    const hook=window.demo.home.strategy.generate;
    await import(new URL("../dist/ha-room-outlet-card.js?duplicate",location.href));
    return window.demo.home.strategy.generate===hook && window.customCards.filter(card => card.type==="room-outlet-card").length===1;
  }),"Global and Lovelace loads cannot double-register the card or hook");
  const card=page.locator("room-outlet-card").first();
  assert(await card.getByRole("switch").count()===1,"One control in the card");
  assert(await card.locator(".metric").count()===2,"Power and energy are inside the same card");
  await card.getByRole("switch").click();
  await page.waitForFunction(() => window.demo.getState("switch.living_room_tv_outlet").state==="off");
  assert(await card.getByRole("switch").getAttribute("aria-checked")==="false","Home card receives authoritative state updates");
  assert(await page.evaluate(() => window.demo.calls.at(-1).data.entity_id)==="switch.living_room_tv_outlet","Only the configured public outlet is controlled");
  await page.evaluate(() => window.demo.setState("sensor.living_room_tv_power","unknown"));
  assert((await card.locator('[data-kind="power"] .reading').textContent()).includes("Неизвестно"),"Unknown power is not zero");
  assert(await card.getByRole("switch").isEnabled(),"Sensor failure does not block the switch");
  await page.evaluate(() => window.demo.reset());
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width,height:1000 });
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth)),"Home overflow at "+width);
  }
  await page.setViewportSize({ width:390,height:844 });
  await page.screenshot({ path:"output/playwright/home-mobile.png",fullPage:true });
  await page.getByRole("button",{ name:"Сменить тему",exact:true }).click();
  await page.screenshot({ path:"output/playwright/home-mobile-dark.png",fullPage:true });
  await page.setViewportSize({ width:1440,height:1000 });
  await page.screenshot({ path:"output/playwright/home-desktop-dark.png",fullPage:true });
  await page.reload();
  await page.waitForFunction(() => window.demo?.home?.ready);
  const nextBuild=await page.evaluate(() => performance.getEntriesByType("resource").find(entry => new URL(entry.name).searchParams.has("home-build"))?.name);
  assert(nextBuild && nextBuild!==build,"Each load bypasses a stale HACS bundle cache");
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Bootstrap reload is passive");
  return { replacements:7,nativeDuplicateTiles:0,checks:"passed" };
}
