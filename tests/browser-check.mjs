async page => {
  const assert=(value,message) => { if (!value) throw new Error(message); };
  await page.waitForFunction(() => Boolean(window.demo?.cards?.length));
  assert(await page.evaluate(() => window.roomOutletCardHome===undefined),"Normal Lovelace resource does not install a Home hook");
  const cards=page.locator("room-outlet-card");
  const living=cards.nth(0);
  const office=cards.nth(2);
  assert(await page.locator(".room").count()===4,"Four preview rooms");
  assert(await cards.count()===7,"One independent card per outlet");
  assert(await cards.evaluateAll(elements => elements.every(card => card.shadowRoot.querySelectorAll(".outlet").length===1 && !card.shadowRoot.querySelector("header"))),"Standalone outlets have no room heading or multi-outlet list");
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Rendering is passive");
  assert((await office.locator('[data-kind="power"] .reading').first().textContent()).includes("245"),"kW is converted to W");
  await living.getByRole("switch",{ name:"TV Wall Outlet",exact:true }).click();
  await page.waitForFunction(() => window.demo.getState("switch.living_room_tv_outlet").state==="off");
  assert(await page.evaluate(() => JSON.stringify(window.demo.calls[0]))===JSON.stringify({ domain:"switch",service:"turn_off",data:{ entity_id:"switch.living_room_tv_outlet" } }),"Exact outlet command");
  assert((await living.locator('[data-kind="power"] .reading').first().textContent()).includes("83,2"),"Off does not fabricate a zero reading");
  assert(await page.evaluate(() => window.demo.getState("switch.living_room_lodge_outlet").state)==="on","Other outlet untouched");

  await page.evaluate(() => { window.demo.reset(); window.demo.setState("switch.living_room_tv_outlet","off"); window.demo.delay=500; });
  const toggle=living.getByRole("switch",{ name:"TV Wall Outlet",exact:true });
  await toggle.click(); await toggle.click();
  assert(await page.evaluate(() => window.demo.calls.map(call => call.service).join(","))==="turn_on,turn_off","Rapid clicks replace desired state");
  await page.waitForTimeout(650);
  assert(await toggle.getAttribute("aria-checked")==="false","Rapid final state");
  await page.evaluate(() => { window.demo.reset(); window.demo.setState("sensor.living_room_tv_power","unavailable"); window.demo.setState("sensor.living_room_tv_energy","unknown"); });
  assert(await toggle.isEnabled(),"Missing measurements do not disable relay");
  assert((await living.locator('[data-kind="power"] .reading').first().textContent()).includes("Недоступно"),"Missing power is not zero");
  assert((await living.locator('[data-kind="energy"] .reading').first().textContent()).includes("Неизвестно"),"Unknown energy is not zero");
  await page.evaluate(() => window.demo.setState("switch.living_room_tv_outlet","unavailable"));
  assert(await toggle.isDisabled(),"Unavailable relay is disabled");
  await page.evaluate(() => window.demo.setState("switch.living_room_tv_outlet","unknown"));
  assert(await toggle.isDisabled(),"Unknown relay is disabled");

  await page.evaluate(() => { window.demo.reset(); window.demo.failNext=true; });
  await toggle.click();
  assert((await living.getByRole("alert").textContent()).includes("Service unavailable"),"Service error visible");
  assert(await toggle.getAttribute("aria-checked")==="true","Service failure does not fake relay state");
  await page.evaluate(() => { window.demo.reset(); window.demo.stall=true; });
  await toggle.click();
  assert(await toggle.getAttribute("aria-checked")==="true","Service acceptance is not confirmation");
  assert(await toggle.isEnabled(),"Pending command does not lock control");
  await page.waitForTimeout(10200);
  assert((await living.getByRole("alert").textContent()).includes("Состояние не подтвердилось"),"Confirmation timeout");
  await page.evaluate(() => window.demo.setState("switch.living_room_tv_outlet","off"));
  await page.waitForTimeout(50);
  assert(await living.getByRole("alert").count()===0,"Late state clears obsolete warning");

  await page.evaluate(() => window.demo.reset());
  await living.locator('[data-kind="energy"]').first().click();
  assert(await page.locator("#more-info").textContent()==="sensor.living_room_tv_energy","Reading opens exact sensor");
  await page.getByRole("button",{ name:"Закрыть",exact:true }).click();
  await page.evaluate(() => window.demo.editor.setConfig({ type:"custom:room-outlet-card",...window.demo.configs[0] }));
  await page.getByRole("button",{ name:"Редактор карточки",exact:true }).click();
  const editor=page.locator("room-outlet-card-editor");
  await editor.getByRole("textbox",{ name:"Название",exact:true }).first().fill("A Very Long Room Name To Verify Layout");
  assert(await page.evaluate(() => window.demo.editorChanges.at(-1).name)==="A Very Long Room Name To Verify Layout","Editor emits config");
  await editor.getByRole("combobox",{ name:"Датчик мощности",exact:true }).first().selectOption("sensor.office_desk_power");
  assert(await page.evaluate(() => window.demo.editorChanges.at(-1).entities[0].power)==="sensor.office_desk_power","Explicit sensor selection");
  await editor.getByRole("button",{ name:"Добавить розетку",exact:true }).click();
  assert(await editor.locator("section").count()===3,"Editor adds row");
  await editor.getByRole("button",{ name:"Удалить",exact:true }).last().click();
  await editor.getByRole("button",{ name:"Ниже",exact:true }).first().click();
  assert(await page.evaluate(() => window.demo.editorChanges.at(-1).entities[0].entity)==="switch.living_room_lodge_outlet","Editor changes order");
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Editing is passive");
  await page.getByRole("button",{ name:"Закрыть редактор",exact:true }).click();
  await page.evaluate(() => window.demo.reset());
  assert(await cards.evaluateAll(elements => elements.every(card => card.shadowRoot.querySelectorAll(".outlet").length===1)),"Each outlet remains an independent card");

  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width,height:1000 });
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth)),"Page overflow at "+width);
    assert(await cards.evaluateAll(elements => elements.every(card => card.shadowRoot.querySelector("ha-card").scrollWidth<=card.clientWidth)),"Card overflow at "+width);
  }
  await page.setViewportSize({ width:1440,height:1000 });
  await page.screenshot({ path:"output/playwright/desktop.png",fullPage:true });
  await page.setViewportSize({ width:390,height:844 });
  await page.screenshot({ path:"output/playwright/mobile.png",fullPage:true });
  await page.getByRole("button",{ name:"Сменить тему",exact:true }).click();
  await page.screenshot({ path:"output/playwright/mobile-dark.png",fullPage:true });
  await page.setViewportSize({ width:1440,height:1000 });
  await page.screenshot({ path:"output/playwright/desktop-dark.png",fullPage:true });
  await page.getByRole("combobox",{ name:"Язык",exact:true }).selectOption("en");
  assert((await living.locator('[data-kind="energy"] .metric-label').first().textContent()).includes("Energy total"),"English labels");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.demo?.cards?.length));
  assert(await page.evaluate(() => window.demo.calls.length)===0,"Reload is passive");
  return { rooms:4,outlets:7,widths:[320,390,768,1440],checks:"passed" };
}
