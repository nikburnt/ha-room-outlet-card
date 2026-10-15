import test from "node:test";
import assert from "node:assert/strict";
import { homeSettings, replaceOutletSections, installHomeExtension, refreshOpenAreaViews } from "../src/home.js";

const item={ entity:"switch.office_desk_outlet",name:"Desk Outlet",power:"sensor.office_desk_outlet_power",energy:"sensor.office_desk_outlet_shelly_energy" };
const config={ type:"home-area",home_panel:true,area:"office" };
const settings={ schema_version:1,enabled:true,outlets:[item] };
function fixture() {
  const ids=[item.entity,item.power,"sensor.office_desk_outlet_energy","sensor.office_desk_outlet_current"];
  const hass={ config:{ version:"2026.9.4" },connection:{},entities:Object.fromEntries(ids.map(id => [id,{ device_id:"desk" }])),devices:{ desk:{ area_id:"office" } },callWS:async () => ({ value:settings }),callService() { throw new Error("Home extension must never call services"); } };
  const other={ type:"grid",cards:[{ type:"tile",entity:"cover.window" }] };
  const outlet={ type:"grid",cards:[{ type:"heading",heading:"Desk Outlet" },...ids.map(entity => ({ type:"tile",entity }))] };
  const view={ type:"sections",title:"Office",badges:[{ entity:"sensor.room_temperature" }],sections:[other,outlet] };
  return { hass,view,outlet,other };
}
function installer(view,extra={}) {
  class Native { static async generate() { return view; } }
  const warnings=[];
  const registry={ whenDefined:async () => undefined,get:() => Native };
  const owner={};
  const state=installHomeExtension({ registry,owner,root:null,warn:message => warnings.push(message),...extra });
  return { Native,state,owner,registry,warnings };
}

test("Home configuration is explicit, opt-in and versioned",() => {
  assert.equal(homeSettings(null),null);
  assert.equal(homeSettings({ enabled:false }),null);
  assert.deepEqual(homeSettings(settings),[item]);
  assert.throws(() => homeSettings({ ...settings,schema_version:2 }));
  assert.throws(() => homeSettings({ ...settings,outlets:[item,item] }));
});
test("one outlet section becomes one real card without native duplicates",() => {
  const { hass,view,other }=fixture();
  const before=structuredClone(view);
  const result=replaceOutletSections(view,config,hass,[item]);
  assert.equal(result.replaced,1);
  assert.equal(result.skipped,0);
  assert.equal(result.view.sections[0],other);
  assert.deepEqual(result.view.sections[1].cards,[{ type:"custom:room-outlet-card",entities:[item],grid_options:{ columns:12,rows:"auto" } }]);
  assert.deepEqual(view,before);
  assert.equal(result.view.badges,view.badges);
});
test("does not alter other dashboards or room membership",() => {
  const { hass,view }=fixture();
  for (const options of [{ ...config,home_panel:false },{ ...config,area:"bedroom" }]) assert.equal(replaceOutletSections(view,options,hass,[item]).view,view);
  assert.equal(replaceOutletSections(view,config,hass,[]).view,view);
});
test("entity area overrides the device area",() => {
  const { hass,view }=fixture();
  hass.entities[item.entity].area_id="bedroom";
  assert.equal(replaceOutletSections(view,config,hass,[item]).view,view);
  assert.equal(replaceOutletSections(view,{ ...config,area:"bedroom" },hass,[item]).replaced,1);
});
test("hidden controls and unknown metadata remain native",() => {
  for (const change of [entity => { entity.hidden=true; },entity => { entity.disabled_by="user"; },entity => { entity.device_id=null; }]) {
    const { hass,view }=fixture(); change(hass.entities[item.entity]);
    assert.equal(replaceOutletSections(view,config,hass,[item]).view,view);
  }
});
test("never hides unrelated controls, alerts or unknown card layouts",() => {
  for (const extra of [{ type:"tile",entity:"switch.other_load" },{ type:"tile",entity:"binary_sensor.overheating" },{ type:"custom:other-card",entity:item.power }]) {
    const { hass,view,outlet }=fixture();
    hass.entities[extra.entity]={ device_id:"desk" };
    outlet.cards.push(extra);
    const result=replaceOutletSections(view,config,hass,[item]);
    assert.equal(result.view,view);
    assert.equal(result.skipped,1);
  }
});
test("unknown shapes and missing headings remain native",() => {
  const { hass,view,outlet }=fixture();
  outlet.cards.shift();
  assert.equal(replaceOutletSections(view,config,hass,[item]).view,view);
  assert.equal(replaceOutletSections({ type:"sections" },config,hass,[item]).replaced,0);
});
test("missing energy feedback does not remove the outlet's control",() => {
  const { hass,view }=fixture();
  assert.equal(hass.entities[item.energy],undefined);
  assert.equal(replaceOutletSections(view,config,hass,[item]).replaced,1);
});
test("installer is idempotent and keeps all reads on the current connection",async () => {
  const { hass,view }=fixture(); let reads=0;
  hass.callWS=async message => { assert.deepEqual(message,{ type:"frontend/get_system_data",key:"room_outlet_card" }); reads++; return { value:settings }; };
  const setup=installer(view); await setup.state.ready;
  const wrapper=setup.Native.generate;
  assert.equal(installHomeExtension({ registry:setup.registry,owner:setup.owner }),setup.state);
  for (let i=0;i<3;i++) assert.equal((await setup.Native.generate(config,hass)).sections[1].cards.length,1);
  assert.equal(reads,1); assert.equal(setup.Native.generate,wrapper);
  assert.equal(setup.owner.roomOutletCardHome.history.at(-1).replaced,1);
  const copy=setup.owner.roomOutletCardHome.history; copy[0].replaced=99;
  assert.equal(setup.owner.roomOutletCardHome.history[0].replaced,1);
});
test("unsupported HA and non-Home dashboards do not read settings",async () => {
  const { hass,view }=fixture(); hass.callWS=() => { throw new Error("Should not read"); };
  const setup=installer(view); await setup.state.ready;
  assert.equal(await setup.Native.generate({ ...config,home_panel:false },hass),view);
  hass.config.version="2026.10.0";
  assert.equal(await setup.Native.generate(config,hass),view);
  assert.equal(await setup.Native.generate(config,hass),view);
  assert.equal(setup.warnings.length,1);
});
test("disabled settings, malformed configuration and fetch failures leave native controls",async () => {
  for (const value of [null,{ enabled:false },{ ...settings,outlets:[{}] }]) {
    const { hass,view }=fixture(); hass.callWS=async () => ({ value });
    const setup=installer(view); await setup.state.ready;
    assert.equal(await setup.Native.generate(config,hass),view);
  }
  const { hass,view }=fixture(); let fail=true;
  hass.callWS=async () => { if (fail) throw new Error("Disconnected"); return { value:settings }; };
  const setup=installer(view); await setup.state.ready;
  assert.equal(await setup.Native.generate(config,hass),view);
  fail=false;
  assert.equal((await setup.Native.generate(config,hass)).sections[1].cards[0].type,"custom:room-outlet-card");
});
test("a stalled settings read is bounded and can be retried",async () => {
  const { hass,view }=fixture(); hass.callWS=() => new Promise(() => {});
  const setup=installer(view,{ timeout:5 }); await setup.state.ready;
  assert.equal(await setup.Native.generate(config,hass),view);
  hass.callWS=async () => ({ value:settings });
  assert.equal((await setup.Native.generate(config,hass)).sections[1].cards[0].type,"custom:room-outlet-card");
});
test("supports a native strategy registered after the extension",async () => {
  const { hass,view }=fixture(); let resolve;
  const setup=installer(view,{ registry:{ whenDefined:() => new Promise(done => { resolve=done; }),get:() => setup.Native } });
  assert.equal(setup.state.status,"waiting"); resolve(); await setup.state.ready;
  assert.equal((await setup.Native.generate(config,hass)).sections[1].cards[0].type,"custom:room-outlet-card");
});
test("late loading refreshes only active native Home area views",() => {
  let native=0; let other=0;
  const make=(home_panel,callback) => ({ localName:"hui-view",index:0,lovelace:{ config:{ views:[{ strategy:{ type:"home-area",home_panel } }] } },_debounceRefreshConfig:callback });
  const root={ querySelectorAll:() => [make(true,() => native++),make(false,() => other++),{ shadowRoot:{ querySelectorAll:() => [make(true,() => native++)] } }] };
  assert.equal(refreshOpenAreaViews(root),2); assert.equal(native,2); assert.equal(other,0);
});
