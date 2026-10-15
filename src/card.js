import { LitElement, html, css, nothing } from "lit";
import { normalizeConfig, controllable, nextPower, powerCommand, formatReading } from "./model.js";

const WORDS = {
  en: { title: "Outlets", power: "Power now", energy: "Energy total", on: "On", off: "Off", unknown: "Unknown", unavailable: "Unavailable", pending: "Awaiting state", timeout: "State not confirmed", more: "More information", turnOn: "Turn on", turnOff: "Turn off", name: "Name", icon: "Icon", entity: "Outlet switch", add: "Add outlet", remove: "Remove", up: "Move up", down: "Move down", outlet: "Outlet", powerSensor: "Power sensor", energySensor: "Cumulative energy sensor" },
  ru: { title: "Розетки", power: "Сейчас", energy: "Потреблено", on: "Включено", off: "Выключено", unknown: "Неизвестно", unavailable: "Недоступно", pending: "Ждём состояние", timeout: "Состояние не подтвердилось", more: "Подробнее", turnOn: "Включить", turnOff: "Выключить", name: "Название", icon: "Иконка", entity: "Выключатель розетки", add: "Добавить розетку", remove: "Удалить", up: "Выше", down: "Ниже", outlet: "Розетка", powerSensor: "Датчик мощности", energySensor: "Накопительный счётчик энергии" }
};
const wordsFor = hass => WORDS[hass?.language?.startsWith("ru") ? "ru" : "en"];
const icon = name => html`<ha-icon .icon=${name}></ha-icon>`;

class RoomOutletCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, pending: { state: true }, errors: { state: true } };
  constructor() { super(); this.pending = {}; this.errors = {}; }
  setConfig(config) {
    const normalized = normalizeConfig(config);
    this.clearPending();
    this.config = normalized;
    this.errors = {};
  }
  static getConfigElement() { return document.createElement("room-outlet-card-editor"); }
  static getStubConfig() { return { name: "Outlets", entities: [] }; }
  get showHeading() { return Boolean(this.config?.name) || this.config?.entities.length !== 1; }
  getCardSize() { return (this.showHeading ? 1 : 0) + (this.config?.entities.length || 0) * 2; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  get words() { return wordsFor(this.hass); }
  clearPending() { for (const command of Object.values(this.pending)) clearTimeout(command.timer); this.pending = {}; }
  disconnectedCallback() { super.disconnectedCallback(); this.clearPending(); }
  updated(changed) {
    if (!changed.has("hass")) return;
    for (const [entity, command] of Object.entries(this.pending)) this.confirm(entity, command);
    const before = changed.get("hass");
    const errors = { ...this.errors };
    for (const entity of Object.keys(errors)) {
      if (controllable(this.hass?.states[entity]) && before?.states[entity]?.state !== this.hass.states[entity].state) delete errors[entity];
    }
    if (Object.keys(errors).length !== Object.keys(this.errors).length) this.errors = errors;
  }
  confirm(entity, command) {
    if (this.pending[entity] !== command || this.hass?.states[entity]?.state !== (command.desired ? "on" : "off")) return;
    clearTimeout(command.timer);
    const pending = { ...this.pending }; delete pending[entity]; this.pending = pending;
  }
  async toggle(entity) {
    if (!this.config.entities.some(item => item.entity === entity) || !controllable(this.hass?.states[entity])) return;
    const desired = nextPower(this.hass.states[entity], this.pending[entity]);
    clearTimeout(this.pending[entity]?.timer);
    const command = { desired };
    command.timer = setTimeout(() => {
      if (this.pending[entity] !== command) return;
      const pending = { ...this.pending }; delete pending[entity]; this.pending = pending;
      this.errors = { ...this.errors, [entity]: this.words.timeout };
    }, 10000);
    this.pending = { ...this.pending, [entity]: command };
    const errors = { ...this.errors }; delete errors[entity]; this.errors = errors;
    const request = powerCommand(entity, desired);
    try {
      await this.hass.callService(request.domain, request.service, request.data);
      this.confirm(entity, command);
    } catch (error) {
      if (this.pending[entity] !== command) return;
      clearTimeout(command.timer);
      const pending = { ...this.pending }; delete pending[entity]; this.pending = pending;
      this.errors = { ...this.errors, [entity]: error.message || String(error) };
    }
  }
  moreInfo(entity) { this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true })); }
  name(item) { return item.name || this.hass.states[item.entity]?.attributes?.friendly_name || item.entity; }
  status(entity) {
    const state = this.hass.states[entity]?.state;
    return this.pending[entity] ? this.words.pending : this.words[state] || this.words.unavailable;
  }
  metric(item, kind) {
    const result = formatReading(this.hass.states[item[kind]], kind, this.hass.locale?.language || this.hass.language || "en");
    const text = result.text === null ? this.words[result.status] : result.text;
    return html`<button class="metric ${result.status !== "ok" ? "missing" : ""}" type="button"
      data-kind=${kind} title=${this.words.more + ": " + this.words[kind]} @click=${() => this.moreInfo(item[kind])}>
      <span class="metric-label">${icon(kind === "power" ? "mdi:flash-outline" : "mdi:counter")}${this.words[kind]}</span>
      <span class="reading">${text}${result.text === null ? nothing : html`<span class="unit">${result.unit}</span>`}</span>
    </button>`;
  }
  render() {
    if (!this.config || !this.hass) return nothing;
    return html`<ha-card class=${this.showHeading ? "" : "standalone"}>${this.showHeading ? html`<header>${icon(this.config.icon || "mdi:power-socket-eu")}<h2>${this.config.name || this.words.title}</h2></header>` : nothing}
      <div class="outlets">${this.config.entities.map(item => {
        const state = this.hass.states[item.entity];
        const on = state?.state === "on";
        return html`<section class="outlet" data-entity=${item.entity}>
          <div class="control">
            <button type="button" class="socket icon-button ${on ? "on" : ""}" title=${this.words.more + ": " + this.name(item)} aria-label=${this.words.more + ": " + this.name(item)} @click=${() => this.moreInfo(item.entity)}>${icon(item.icon || "mdi:power-socket-eu")}</button>
            <div class="label"><button type="button" class="name" @click=${() => this.moreInfo(item.entity)}>${this.name(item)}</button>
              <div class="status" id=${item.entity + "-status"} aria-live="polite">${this.status(item.entity)}</div></div>
            <button type="button" role="switch" class="toggle ${on ? "checked" : ""}" aria-checked=${String(on)} aria-label=${this.name(item)} aria-describedby=${item.entity + "-status"}
              title=${(nextPower(state, this.pending[item.entity]) ? this.words.turnOn : this.words.turnOff) + ": " + this.name(item)} ?disabled=${!controllable(state)} @click=${() => this.toggle(item.entity)}><span class="track"><span class="thumb"></span></span></button>
          </div>
          <div class="metrics">${this.metric(item, "power")}${this.metric(item, "energy")}</div>
          ${this.errors[item.entity] ? html`<div class="error" role="alert">${this.errors[item.entity]}</div>` : nothing}
        </section>`;
      })}</div></ha-card>`;
  }
  static styles = css`
    :host { display:block; font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif); color:var(--primary-text-color,#24292b); letter-spacing:0; }
    * { box-sizing:border-box; letter-spacing:0; }
    ha-card { display:block; background:var(--ha-card-background,var(--card-background-color,#fff)); border:1px solid var(--divider-color,#dfe5e7); border-radius:var(--ha-card-border-radius,8px); box-shadow:var(--ha-card-box-shadow,none); overflow:hidden; }
    button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; touch-action:manipulation; }
    button:focus-visible { outline:2px solid var(--primary-color,#087d8d); outline-offset:2px; }
    button:disabled { opacity:.4; cursor:default; }
    ha-icon { display:inline-flex; width:22px; height:22px; --mdc-icon-size:22px; flex-shrink:0; }
    header { display:flex; align-items:center; gap:12px; padding:18px; min-width:0; }
    header ha-icon { color:var(--secondary-text-color,#69787d); }
    h2 { font-size:17px; line-height:1.4; font-weight:600; margin:0; overflow-wrap:anywhere; }
    .outlets { padding:0 18px; }
    .outlet { padding:14px 0; border-top:1px solid var(--divider-color,#dfe5e7); }
    .standalone .outlet { border-top:0; }
    .control { display:flex; align-items:center; gap:10px; min-height:48px; }
    .icon-button { width:44px; height:44px; padding:10px; border-radius:6px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .socket { background:var(--secondary-background-color,#f2f5f6); color:var(--secondary-text-color,#69787d); }
    .socket.on { color:var(--primary-color,#087d8d); }
    .label { flex:1; min-width:0; }
    .name { display:block; padding:0; width:100%; text-align:left; font-size:14px; line-height:1.5; font-weight:600; overflow-wrap:anywhere; }
    .status { min-height:20px; font-size:12px; line-height:1.7; color:var(--secondary-text-color,#69787d); overflow-wrap:anywhere; }
    .toggle { width:48px; height:44px; padding:0; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .track { width:40px; height:24px; padding:3px; border:1px solid var(--secondary-text-color,#69787d); border-radius:14px; background:var(--secondary-background-color,#f2f5f6); }
    .thumb { display:block; width:16px; height:16px; border-radius:50%; background:var(--secondary-text-color,#69787d); transition:transform .15s ease; }
    .checked .track { background:var(--primary-color,#087d8d); border-color:var(--primary-color,#087d8d); }
    .checked .thumb { background:#fff; transform:translateX(16px); }
    .metrics { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; padding:10px 0 0 54px; }
    .metric { display:block; text-align:left; padding:2px 0; min-width:0; border-radius:2px; }
    .metric-label { display:flex; gap:4px; align-items:center; color:var(--secondary-text-color,#69787d); font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
    .metric-label ha-icon { width:14px; height:14px; --mdc-icon-size:14px; }
    .reading { display:block; font-size:17px; line-height:1.6; font-weight:500; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    .unit { color:var(--secondary-text-color,#69787d); font-size:12px; margin-left:5px; font-weight:400; }
    .missing .reading { color:var(--secondary-text-color,#69787d); font-size:12px; }
    .error { padding:8px 0 0 54px; color:var(--error-color,#be3a3a); font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
    @media(max-width:360px) { header { padding:14px 12px; } .outlets { padding:0 12px; } .control { gap:7px; } .metrics,.error { padding-left:0; } }
    @media(prefers-reduced-motion:reduce) { .thumb { transition:none; } }
  `;
}

class RoomOutletCardEditor extends LitElement {
  static properties = { hass: { attribute:false }, config: { state:true } };
  setConfig(config) { this.config = { ...config, entities:(config.entities || []).map(item => ({ ...item })) }; }
  emit(config) { this.config = config; this.dispatchEvent(new CustomEvent("config-changed", { detail:{ config }, bubbles:true, composed:true })); }
  move(index, offset) {
    const entities = [...this.config.entities];
    [entities[index], entities[index + offset]] = [entities[index + offset], entities[index]];
    this.emit({ ...this.config, entities });
  }
  action(label, symbol, handler, disabled=false) { return html`<button type="button" title=${label} aria-label=${label} ?disabled=${disabled} @click=${handler}>${icon(symbol)}</button>`; }
  render() {
    if (!this.config || !this.hass) return nothing;
    const words = wordsFor(this.hass);
    const label = field => field.name === "power" ? words.powerSensor : field.name === "energy" ? words.energySensor : words[field.name] || field.name;
    const header = [{ name:"name", selector:{ text:{} } }, { name:"icon", selector:{ icon:{} } }];
    const row = [{ name:"entity", required:true, selector:{ entity:{ domain:"switch" } } }, { name:"power", required:true, selector:{ entity:{ domain:"sensor", device_class:"power" } } }, { name:"energy", required:true, selector:{ entity:{ domain:"sensor", device_class:"energy" } } }, { name:"name", selector:{ text:{} } }, { name:"icon", selector:{ icon:{} } }];
    return html`<ha-form .hass=${this.hass} .data=${this.config} .schema=${header} .computeLabel=${label}
      @value-changed=${event => { event.stopPropagation(); this.emit({ ...this.config, ...event.detail.value }); }}></ha-form>
      ${this.config.entities.map((item,index) => html`<section><div class="row-heading"><strong>${words.outlet} ${index+1}</strong><div>
        ${this.action(words.up,"mdi:arrow-up",() => this.move(index,-1),index===0)}
        ${this.action(words.down,"mdi:arrow-down",() => this.move(index,1),index===this.config.entities.length-1)}
        ${this.action(words.remove,"mdi:delete-outline",() => this.emit({ ...this.config, entities:this.config.entities.filter((_,i) => i!==index) }))}</div></div>
        <ha-form .hass=${this.hass} .data=${item} .schema=${row} .computeLabel=${label} @value-changed=${event => {
          event.stopPropagation(); this.emit({ ...this.config, entities:this.config.entities.map((value,i) => i===index ? { ...value,...event.detail.value } : value) });
        }}></ha-form></section>`)}
      <button class="add" type="button" @click=${() => this.emit({ ...this.config, entities:[...this.config.entities,{ entity:"",power:"",energy:"" }] })}>${icon("mdi:plus")}${words.add}</button>`;
  }
  static styles = css`
    :host { display:block; color:var(--primary-text-color,#24292b); font-family:system-ui,sans-serif; }
    * { box-sizing:border-box; letter-spacing:0; }
    section { border-top:1px solid var(--divider-color,#ddd); padding-top:12px; margin-top:16px; }
    .row-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    strong { font-size:14px; }
    button { display:inline-flex; align-items:center; justify-content:center; border:0; border-radius:4px; background:none; color:inherit; width:40px; height:40px; cursor:pointer; }
    button:focus-visible { outline:2px solid var(--primary-color,#087d8d); outline-offset:2px; }
    button:disabled { opacity:.3; cursor:default; }
    ha-icon { width:20px; height:20px; --mdc-icon-size:20px; }
    .add { width:auto; gap:8px; padding:8px 12px; margin-top:16px; font:inherit; color:var(--primary-color,#087d8d); }
  `;
}

export function registerCard() {
  if (!customElements.get("room-outlet-card")) customElements.define("room-outlet-card", RoomOutletCard);
  if (!customElements.get("room-outlet-card-editor")) customElements.define("room-outlet-card-editor", RoomOutletCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some(card => card.type === "room-outlet-card")) window.customCards.push({ type:"room-outlet-card", name:"Room Outlet Card", preview:true, description:"Outlet controls, power and cumulative energy by room.", documentationURL:"https://github.com/nikburnt/ha-room-outlet-card" });
}
