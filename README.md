# Room Outlet Card

A Home Assistant dashboard card with one row per outlet: a switch, current power
in W, and cumulative energy in kWh. Group cards by room and explicitly select the
public logical outlet entities, not duplicate physical integrations.

## Install

Add `nikburnt/ha-room-outlet-card` as a custom Dashboard repository in HACS and
download it. If HACS has not added the resource automatically, add
`/hacsfiles/ha-room-outlet-card/ha-room-outlet-card.js` as a JavaScript module.

```yaml
type: custom:room-outlet-card
name: Office
entities:
  - entity: switch.office_desk_outlet
    name: Desk Outlet
    power: sensor.office_desk_outlet_power
    energy: sensor.office_desk_outlet_shelly_energy
```

Every row requires explicit `entity` (switch), `power` (sensor) and `energy`
(sensor). `name` and `icon` are optional overrides; the card also accepts a room
`icon`. The visual editor supports entity selection and row ordering. No devices
are discovered or added automatically. The card follows Home Assistant's theme
and supports English and Russian.

Power readings in W/kW/mW and energy readings in Wh/kWh/MWh are normalized for
display. Missing and unknown data never become zero. Turning an outlet off does
not fabricate a zero power reading. Energy is the selected counter's cumulative
value, not today's consumption or a reconstructed lifetime total. Its baseline
and reset behavior belong to the device/integration. Use a fixed cumulative
source when failover providers have different counters, as with the fixed
Shelly Native source used by an Energy dashboard. The card does not modify
Energy, Recorder, InfluxDB or device counters.

Toggles call `switch.turn_on` / `switch.turn_off` for exactly one configured
outlet. There is no room-wide off control. Rendering, editing and startup send
no service calls. Displayed relay state remains authoritative; service
acceptance does not count as physical confirmation. Rapid clicks replace the
pending desired state without disabling the toggle. Errors and a 10-second
confirmation timeout are shown. Click an outlet name or reading for Home
Assistant's native more-info dialog.

The card can be used on editable dashboards. It does not inject itself into
Home Assistant's automatic Overview. Native switches and sensors can remain
grouped under their logical device in room views.

## Development

```sh
npm ci
npm test
npm run build
npm run check
```

Open `preview/index.html` for a standalone mocked Home Assistant preview. It has
no connection to real devices. Browser checks are in `tests/browser-check.mjs`
for Playwright CLI `run-code --filename`. Publish the built
`dist/ha-room-outlet-card.js` as a GitHub release asset, then install via HACS;
never patch a live Home Assistant bundle.
