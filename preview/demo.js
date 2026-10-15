import { LitElement, html, css } from "lit";
import { mdiPowerSocketEu, mdiFlashOutline, mdiCounter, mdiArrowUp, mdiArrowDown, mdiDeleteOutline, mdiPlus, mdiThemeLightDark, mdiPencilOutline, mdiClose } from "@mdi/js";

const icons={ "mdi:power-socket-eu":mdiPowerSocketEu, "mdi:flash-outline":mdiFlashOutline, "mdi:counter":mdiCounter, "mdi:arrow-up":mdiArrowUp, "mdi:arrow-down":mdiArrowDown, "mdi:delete-outline":mdiDeleteOutline, "mdi:plus":mdiPlus, "mdi:theme-light-dark":mdiThemeLightDark, "mdi:pencil-outline":mdiPencilOutline, "mdi:close":mdiClose };
class Icon extends HTMLElement {
  static observedAttributes=["icon"];
  set icon(value) { this.setAttribute("icon",value); }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const root=this.shadowRoot || this.attachShadow({ mode:"open" });
    root.innerHTML=`<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="${icons[this.getAttribute("icon")] || mdiPowerSocketEu}"></path></svg>`;
  }
}
customElements.define("ha-icon",Icon);

// Preview-only Home Assistant forms and service feedback; never real devices.
class PreviewForm extends LitElement {
  static properties={ schema:{ attribute:false }, data:{ attribute:false }, hass:{ attribute:false }, computeLabel:{ attribute:false } };
  change(name,value) { this.dispatchEvent(new CustomEvent("value-changed",{ detail:{ value:{ ...this.data,[name]:value } }, bubbles:true, composed:true })); }
  render() {
    return html`${(this.schema || []).map(field => html`<label><span>${this.computeLabel(field)}</span>
      ${field.selector.entity ? html`<select .value=${this.data[field.name] || ""} @change=${event => this.change(field.name,event.target.value)}><option value="">-</option>
        ${Object.keys(this.hass.states).filter(id => id.startsWith(field.selector.entity.domain+".") && (!field.selector.entity.device_class || this.hass.states[id].attributes.device_class===field.selector.entity.device_class)).map(id => html`<option value=${id}>${id}</option>`)}</select>`
        : html`<input type="text" .value=${this.data[field.name] || ""} @input=${event => this.change(field.name,event.target.value)}>`}</label>`)}`;
  }
  static styles=css`:host { display:grid; gap:12px; } label { display:grid; gap:6px; font:13px system-ui,sans-serif; color:var(--secondary-text-color,#626f73); } input,select { box-sizing:border-box; padding:10px; border:1px solid var(--divider-color,#ddd); border-radius:4px; color:var(--primary-text-color,#24292b); background:var(--ha-card-background,#fff); min-width:0; width:100%; font:14px system-ui,sans-serif; letter-spacing:0; }`;
}
customElements.define("ha-form",PreviewForm);

const state=(entity_id,value,attributes={}) => ({ entity_id,state:value,attributes:{ friendly_name:entity_id,...attributes } });
const configs=[
  { name:"Living Room", entities:[{ entity:"switch.living_room_tv_outlet", name:"TV Wall Outlet", power:"sensor.living_room_tv_power", energy:"sensor.living_room_tv_energy" },{ entity:"switch.living_room_lodge_outlet",name:"Lodge Left Outlet",power:"sensor.living_room_lodge_power",energy:"sensor.living_room_lodge_energy" }] },
  { name:"Office", entities:[{ entity:"switch.office_desk_outlet",name:"Desk Outlet",power:"sensor.office_desk_power",energy:"sensor.office_desk_energy" },{ entity:"switch.office_window_outlet",name:"Window Outlet",power:"sensor.office_window_power",energy:"sensor.office_window_energy" }] },
  { name:"Kitchen", entities:[{ entity:"switch.kitchen_cooker_outlet",name:"Cooker Outlet",power:"sensor.kitchen_cooker_power",energy:"sensor.kitchen_cooker_energy" }] },
  { name:"Bedroom", entities:[{ entity:"switch.bedroom_drawer_outlet",name:"Drawer Left Outlet",power:"sensor.bedroom_drawer_power",energy:"sensor.bedroom_drawer_energy" },{ entity:"switch.bedroom_window_outlet",name:"Bed Window Outlet",power:"sensor.bedroom_window_power",energy:"sensor.bedroom_window_energy" }] }
];
const baseline={};
const readings=[[83.2,18.625],[0,3.21],[.245,39.05],[0,0],[1580,24.312],[1.5,.068],[0,.177]];
configs.flatMap(config => config.entities).forEach((item,index) => {
  baseline[item.entity]=state(item.entity,index===3 ? "off":"on");
  baseline[item.power]=state(item.power,String(readings[index][0]),{ device_class:"power",unit_of_measurement:index===2 ? "kW":"W" });
  baseline[item.energy]=state(item.energy,String(readings[index][1]),{ device_class:"energy",unit_of_measurement:"kWh" });
});
let states=structuredClone(baseline);
let language="ru";
const calls=[];
const cards=configs.map(config => { const card=document.createElement("room-outlet-card"); card.setConfig(config); document.getElementById("cards").append(card); return card; });
const editor=document.querySelector("room-outlet-card-editor");
editor.setConfig({ type:"custom:room-outlet-card",...configs[0] });
function update() { const hass={ states:{ ...states },language,locale:{ language },callService }; cards.forEach(card => { card.hass=hass; }); editor.hass=hass; }
async function callService(domain,service,data) {
  calls.push({ domain,service,data:structuredClone(data) });
  if (window.demo.failNext) { window.demo.failNext=false; throw new Error("Service unavailable"); }
  if (window.demo.stall) return;
  await new Promise(resolve => setTimeout(resolve,window.demo.delay));
  states[data.entity_id]=state(data.entity_id,service==="turn_on" ? "on":"off",states[data.entity_id].attributes);
  update();
}
window.demo={ calls,cards,configs,failNext:false,stall:false,delay:250,editorChanges:[],
  setState(id,value,attributes={}) { states[id]=state(id,value,{ ...states[id]?.attributes,...attributes }); update(); },
  getState(id) { return structuredClone(states[id]); },
  reset() { states=structuredClone(baseline); calls.length=0; this.failNext=false; this.stall=false; this.delay=250; cards.forEach((card,index) => card.setConfig(configs[index])); update(); }
};
document.getElementById("theme").addEventListener("click",() => document.body.classList.toggle("dark"));
document.getElementById("language").addEventListener("change",event => { language=event.target.value; update(); });
document.getElementById("scenario").addEventListener("change",event => {
  window.demo.reset();
  for (const [id,item] of Object.entries(states)) {
    if (event.target.value==="offline") item.state="unavailable";
    if (event.target.value==="no-data" && id.startsWith("sensor.")) item.state="unknown";
    if (event.target.value==="off" && id.startsWith("switch.")) item.state="off";
  }
  update();
});
document.getElementById("editor").addEventListener("click",() => document.getElementById("editor-dialog").showModal());
document.getElementById("close-editor").addEventListener("click",() => document.getElementById("editor-dialog").close());
document.getElementById("close-info").addEventListener("click",() => document.getElementById("info-dialog").close());
editor.addEventListener("config-changed",event => { window.demo.editorChanges.push(structuredClone(event.detail.config)); try { cards[0].setConfig(event.detail.config); } catch { /* An unfinished selection is not a valid card yet. */ } });
document.addEventListener("hass-more-info",event => { document.getElementById("more-info").textContent=event.detail.entityId; document.getElementById("info-dialog").showModal(); });
update();
