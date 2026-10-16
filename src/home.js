import { normalizeConfig } from "./model.js";

export const SETTINGS_KEY = "room_outlet_card";
export const SUPPORTED_HA = ["2026.9.4"];
const INSTALL_KEY = Symbol.for("room-outlet-card.home-extension");

export function homeSettings(value) {
  if (!value || value.enabled !== true) return null;
  if (value.schema_version !== 1) throw new Error("Unsupported Home settings schema");
  return normalizeConfig({ entities: value.outlets }).entities;
}

export function replaceOutletSections(view, config, hass, outlets) {
  if (config.home_panel !== true || !config.area || !Array.isArray(view.sections)) return { view, replaced: 0, skipped: 0 };
  const byEntity = new Map(outlets.map(item => [item.entity, item]));
  let replaced = 0;
  let skipped = 0;
  const sections = view.sections.map(section => {
    if (!Array.isArray(section.cards)) return section;
    const targets = section.cards.filter(card => byEntity.has(card.entity));
    if (!targets.length) return section;
    const target = targets[0];
    const entity = hass.entities?.[target.entity];
    const device = hass.devices?.[entity?.device_id];
    const area = entity?.area_id || device?.area_id;
    // Only replace the native, single-outlet device section. Other controls,
    // alerts and unknown future layouts must remain visible in HA's own UI.
    const nativeShape = targets.length === 1 && section.type === "grid" &&
      section.cards[0]?.type === "heading" && section.cards.length > 1 &&
      entity?.device_id && area === config.area && !entity.hidden && !entity.hidden_by && !entity.disabled_by &&
      section.cards.slice(1).every(card => card.type === "tile" &&
        hass.entities?.[card.entity]?.device_id === entity.device_id &&
        (card.entity === target.entity || card.entity.startsWith("sensor.")));
    if (!nativeShape) { skipped++; return section; }
    replaced++;
    return { ...section, cards: [{ type: "custom:room-outlet-card", entities: [{ ...byEntity.get(target.entity) }], grid_options: { columns: 12, rows: "auto" } }] };
  });
  return { view: replaced ? { ...view, sections } : view, replaced, skipped };
}

export function refreshOpenAreaViews(root) {
  if (!root?.querySelectorAll) return 0;
  let count = 0;
  for (const element of root.querySelectorAll("*")) {
    if (element.localName === "hui-view") {
      const strategy = element.lovelace?.config?.views?.[element.index]?.strategy;
      if (strategy?.type === "home-area" && strategy.home_panel === true && typeof element._debounceRefreshConfig === "function") {
        element._debounceRefreshConfig();
        count++;
      }
    }
    if (element.shadowRoot) count += refreshOpenAreaViews(element.shadowRoot);
  }
  return count;
}

function withTimeout(promise, milliseconds) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Home settings request timed out")), milliseconds);
  })]).finally(() => clearTimeout(timer));
}

export function installHomeExtension({ registry = globalThis.customElements, root = globalThis.document, owner = globalThis, warn = message => console.warn(message), timeout = 2000 } = {}) {
  if (owner[INSTALL_KEY]) return owner[INSTALL_KEY];
  const history = [];
  const warnings = new Set();
  const cache = new WeakMap();
  const state = { version: "0.2.1", status: "waiting", history };
  owner[INSTALL_KEY] = state;
  const note = message => {
    if (warnings.has(message)) return;
    warnings.add(message);
    warn("Room Outlet Card Home: " + message);
  };
  const trace = data => { history.push(data); if (history.length > 20) history.shift(); };
  Object.defineProperty(owner, "roomOutletCardHome", { configurable: true, value: Object.freeze({
    get version() { return state.version; },
    get status() { return state.status; },
    get history() { return history.map(item => ({ ...item })); }
  }) });
  async function settings(hass) {
    const connection = hass.connection;
    if (!connection || typeof hass.callWS !== "function") throw new Error("Home Assistant connection unavailable");
    if (!cache.has(connection)) {
      const request = withTimeout(hass.callWS({ type: "frontend/get_system_data", key: SETTINGS_KEY }), timeout)
        .then(result => homeSettings(result.value))
        .catch(error => { cache.delete(connection); throw error; });
      cache.set(connection, request);
    }
    return cache.get(connection);
  }
  state.ready = registry.whenDefined("home-area-view-strategy").then(() => {
    const strategy = registry.get("home-area-view-strategy");
    if (typeof strategy?.generate !== "function") { state.status = "unsupported"; note("Native area generator not found; keeping native cards"); return; }
    const generate = strategy.generate;
    strategy.generate = async function(config, hass) {
      const native = await generate.call(this, config, hass);
      if (config.home_panel !== true) return native;
      if (!SUPPORTED_HA.includes(hass.config?.version)) {
        trace({ area: config.area, replaced: 0, reason: "unsupported_ha" });
        note("HA " + hass.config?.version + " is not validated; keeping native cards");
        return native;
      }
      try {
        const outlets = await settings(hass);
        if (!outlets) { trace({ area: config.area, replaced: 0, reason: "disabled" }); return native; }
        const result = replaceOutletSections(native, config, hass, outlets);
        trace({ area: config.area, replaced: result.replaced, skipped: result.skipped });
        if (result.skipped) note("Unrecognized outlet section in " + config.area + "; keeping that section's native cards");
        return result.view;
      } catch (error) {
        trace({ area: config.area, replaced: 0, reason: "fallback" });
        note(error.message + "; keeping native cards");
        return native;
      }
    };
    state.status = "installed";
    state.refreshed = refreshOpenAreaViews(root);
  }).catch(error => { state.status = "unsupported"; note(error.message); });
  return state;
}
