const originals=window.demo.cards;
const allItems=window.demo.configs.flatMap(room => room.entities);
const entities={};
const devices={};
const areas=window.demo.configs.map(room => ({ id:room.name.toLowerCase().replaceAll(" ","_"),name:room.name,items:room.entities }));
for (const area of areas) for (const item of area.items) {
  const device_id="device-"+item.entity;
  devices[device_id]={ area_id:area.id };
  for (const eid of [item.entity,item.power,item.energy]) entities[eid]={ device_id };
}
const connection={};
const reads=[];
const settings={ schema_version:1,enabled:true,outlets:allItems };
let rendered=[];
const hassFor=base => ({ ...base,connection,entities,devices,config:{ version:"2026.9.4" },callWS:async message => { reads.push(message); return { value:settings }; } });
class NativeHomeArea extends HTMLElement {
  static async generate(config) {
    const area=areas.find(item => item.id===config.area);
    return { type:"sections",sections:area.items.map(item => ({ type:"grid",cards:[
      { type:"heading",heading:item.name },
      { type:"tile",entity:item.energy },{ type:"tile",entity:item.power },{ type:"tile",entity:item.entity }
    ] })) };
  }
}
customElements.define("home-area-view-strategy",NativeHomeArea);
while (window.roomOutletCardHome.status==="waiting") await new Promise(resolve => setTimeout(resolve,0));
const root=document.getElementById("cards");
root.replaceChildren();
window.demo.home={ reads,areas,results:[],strategy:NativeHomeArea };
for (const area of areas) {
  const result=await NativeHomeArea.generate({ type:"home-area",home_panel:true,area:area.id },hassFor(originals[0].hass));
  window.demo.home.results.push(result);
  const section=document.createElement("section"); section.className="room";
  const title=document.createElement("h2"); title.textContent=area.name; section.append(title);
  for (const device of result.sections) for (const config of device.cards) {
    if (config.type!=="custom:room-outlet-card") throw new Error("Expected one combined outlet card");
    const card=document.createElement("room-outlet-card"); card.setConfig(config); card.hass=hassFor(originals[0].hass);
    section.append(card); rendered.push(card);
  }
  root.append(section);
}
window.demo.onUpdate=base => { for (const card of rendered) card.hass=hassFor(base); };
window.demo.home.ready=true;
