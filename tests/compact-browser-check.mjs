async page => {
  const assert=(value,message) => { if (!value) throw new Error(message); };
  await page.waitForFunction(() => Boolean(window.demo?.cards?.length));
  const card=page.locator("room-outlet-card").first();
  await page.setViewportSize({ width:1440,height:1000 });
  const initial=await card.boundingBox();
  assert(initial.height<=72,"A normal standalone outlet must be at most 72px high, got "+initial.height);
  assert(await card.locator(".status").evaluate(element => element.classList.contains("sr-only")),"Normal on/off status must not repeat the toggle visually");
  assert(await card.getByRole("switch").getAttribute("aria-checked")==="true","On state remains accessible");
  assert(await card.evaluate(element => element.getCardSize())===1,"Masonry estimate matches the compact card");
  const sizes=[];
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width,height:1000 });
    assert(await page.locator("room-outlet-card").evaluateAll(elements => elements.every(element => element.shadowRoot.querySelector("ha-card").scrollWidth<=element.clientWidth)),"Compact contents overflow at "+width);
    const bounds=await card.boundingBox();
    assert(bounds.height<=96,"Compact card too tall at "+width+": "+bounds.height);
    sizes.push({ width,cardWidth:bounds.width,height:bounds.height });
  }
  await page.evaluate(() => window.demo.setState("switch.living_room_tv_outlet","off"));
  assert(await card.locator(".status").evaluate(element => element.classList.contains("sr-only")),"Off status also avoids visual duplication");
  assert(await card.getByRole("switch").getAttribute("aria-checked")==="false","Off state remains accessible");
  for (const state of ["unknown","unavailable"]) {
    await page.evaluate(value => window.demo.setState("switch.living_room_tv_outlet",value),state);
    assert(!(await card.locator(".status").evaluate(element => element.classList.contains("sr-only"))),"Relay "+state+" must stay visible");
    assert(await card.getByRole("switch").isDisabled(),"Unavailable relay cannot be controlled");
  }
  await page.evaluate(() => window.demo.reset());
  await card.evaluate(element => element.setConfig({ ...element.config,entities:element.config.entities.map(item => ({ ...item,name:"TV Wall Window Right Outlet" })) }));
  for (const width of [320,390,1440]) {
    await page.setViewportSize({ width,height:844 });
    assert(await card.evaluate(element => element.shadowRoot.querySelector("ha-card").scrollWidth<=element.clientWidth),"Long real outlet name overflows at "+width);
  }
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Compact rendering and layout tests issue no commands");
  await page.evaluate(() => window.demo.reset());
  await page.setViewportSize({ width:390,height:844 });
  await page.screenshot({ path:"output/playwright/compact-mobile.png",fullPage:true });
  await page.getByRole("button",{ name:"Сменить тему",exact:true }).click();
  await page.setViewportSize({ width:1440,height:1000 });
  await page.screenshot({ path:"output/playwright/compact-desktop-dark.png",fullPage:true });
  return { sizes,checks:"passed" };
}
