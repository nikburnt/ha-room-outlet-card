export function normalizeConfig(config) {
  if (!config || !Array.isArray(config.entities)) throw new Error("entities must be an explicit outlet list");
  const seen = new Set();
  const entities = config.entities.map(item => {
    if (!item || typeof item !== "object" || !/^switch\.[a-z0-9_]+$/.test(item.entity || "")) throw new Error("Each outlet requires a switch entity");
    if (seen.has(item.entity)) throw new Error("Duplicate outlet: " + item.entity);
    seen.add(item.entity);
    for (const key of ["power", "energy"]) {
      if (!/^sensor\.[a-z0-9_]+$/.test(item[key] || "")) throw new Error("Each outlet requires an explicit " + key + " sensor");
    }
    return { ...item };
  });
  return { ...config, entities };
}

export const controllable = state => state?.state === "on" || state?.state === "off";
export const nextPower = (state, pending) => pending ? !pending.desired : state?.state !== "on";
export const powerCommand = (entity, on) => ({ domain: "switch", service: on ? "turn_on" : "turn_off", data: { entity_id: entity } });

const UNITS = { power: { W: 1, kW: 1000, mW: 0.001 }, energy: { Wh: 0.001, kWh: 1, MWh: 1000 } };
export function reading(state, kind) {
  if (!state || state.state === "unavailable") return { value: null, status: "unavailable" };
  if (state.state === "unknown" || typeof state.state !== "string" || !state.state.trim()) return { value: null, status: "unknown" };
  const value = Number(state.state);
  const factor = UNITS[kind]?.[state.attributes?.unit_of_measurement];
  if (!Number.isFinite(value) || typeof factor !== "number" || !Number.isFinite(value * factor)) return { value: null, status: "unknown" };
  return { value: value * factor, status: "ok" };
}

export function formatReading(state, kind, locale = "en") {
  const result = reading(state, kind);
  return { ...result, text: result.value === null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: kind === "power" ? 1 : 3 }).format(result.value), unit: kind === "power" ? "W" : "kWh" };
}
