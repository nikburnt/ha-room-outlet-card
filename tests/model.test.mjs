import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig, controllable, nextPower, powerCommand, reading, formatReading } from "../src/model.js";

const outlet={ entity:"switch.room_outlet", power:"sensor.room_power", energy:"sensor.room_energy", name:"Desk Outlet" };
const state=(value,unit) => ({ state:value, attributes:{ unit_of_measurement:unit } });
test("configuration requires explicit switch and both sensors",() => {
  assert.deepEqual(normalizeConfig({ entities:[outlet] }).entities,[outlet]);
  for (const item of [null,{}, { ...outlet,entity:"light.room" }, { ...outlet,power:"" }, { ...outlet,energy:"switch.room" }]) assert.throws(() => normalizeConfig({ entities:[item] }));
  assert.throws(() => normalizeConfig({ entities:[outlet,outlet] }));
  assert.deepEqual(normalizeConfig({ entities:[] }).entities,[]);
});
test("configuration does not mutate its inputs",() => {
  const source={ entities:[{ ...outlet }] };
  const result=normalizeConfig(source); result.entities[0].name="Changed";
  assert.equal(source.entities[0].name,"Desk Outlet");
});
test("only a known relay can be controlled",() => {
  for (const value of ["on","off"]) assert.equal(controllable(state(value)),true);
  for (const value of ["unknown","unavailable","",undefined]) assert.equal(controllable(state(value)),false);
  assert.equal(controllable(undefined),false);
});
test("commands target exactly the public outlet",() => {
  assert.deepEqual(powerCommand(outlet.entity,false),{ domain:"switch", service:"turn_off", data:{ entity_id:outlet.entity } });
  assert.equal(nextPower(state("off"),{ desired:true }),false);
  assert.equal(nextPower(state("on"),{ desired:false }),true);
});
test("power readings normalize to W including real zero",() => {
  assert.equal(reading(state("1.5","kW"),"power").value,1500);
  assert.equal(reading(state("500","mW"),"power").value,.5);
  assert.equal(reading(state("0","W"),"power").value,0);
});
test("cumulative energy normalizes to kWh without estimating",() => {
  assert.equal(reading(state("1250","Wh"),"energy").value,1.25);
  assert.equal(reading(state("1.2","MWh"),"energy").value,1200);
  assert.equal(reading(state("0","kWh"),"energy").value,0);
});
test("missing, unavailable, nonfinite and unsupported units are not zeros",() => {
  for (const value of ["unknown","unavailable",""," ","NaN","Infinity","abc"]) assert.equal(reading(state(value,"W"),"power").value,null);
  assert.equal(reading(undefined,"power").value,null);
  assert.equal(reading(state("10","V"),"power").value,null);
  assert.equal(reading(state("10","constructor"),"power").value,null);
  assert.equal(reading(state("1e308","kW"),"power").value,null);
  assert.equal(reading(state("1","W"),"energy").value,null);
});
test("formatting preserves appropriate precision and locale",() => {
  assert.equal(formatReading(state("1000.24","W"),"power","en").text,"1,000.2");
  assert.equal(formatReading(state("1.23456","kWh"),"energy","en").text,"1.235");
  assert.equal(formatReading(state("1.5","kW"),"power","ru").unit,"W");
  assert.equal(formatReading(state("unknown","kWh"),"energy").text,null);
});
