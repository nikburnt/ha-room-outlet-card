# Room Outlet Card

A Home Assistant dashboard card for an individual outlet: a switch, current power
in W, and cumulative energy in kWh. Group separate cards by room and explicitly select the
public logical outlet entities, not duplicate physical integrations.

## Install

Add `nikburnt/ha-room-outlet-card` as a custom Dashboard repository in HACS and
download it. If HACS has not added the resource automatically, add
`/hacsfiles/ha-room-outlet-card/ha-room-outlet-card.js` as a JavaScript module.

```yaml
type: custom:room-outlet-card
entities:
  - entity: switch.office_desk_outlet
    name: Desk Outlet
    power: sensor.office_desk_outlet_power
    energy: sensor.office_desk_outlet_shelly_energy
```

Use one entity item per card for one independent outlet element. With one outlet
and no top-level `name`, there is no redundant room heading inside the card.
Put the room name in the dashboard section heading, outside the outlet cards.
Existing multi-outlet configurations remain supported for compatibility.

Every item requires explicit `entity` (switch), `power` (sensor) and `energy`
(sensor). `name` and `icon` are optional item overrides; a top-level `name` adds
an optional card heading. The visual editor supports entity selection and row ordering. No devices
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

## Automatic Home Extension

Version 0.2.0 adds an opt-in extension for the built-in Home dashboard's room
views. It replaces each selected native outlet device section with **one card
containing its control, power and energy**, not three adjacent entity tiles.
The dashboard stays automatic; unrelated sections, other dashboards and device
registries are not rewritten. No entities need to be hidden for this to work.

This uses HA's internal `home-area-view-strategy` generator, not a public card
replacement API. Currently validated with HA **2026.9.4**. An unvalidated HA
version, disabled/invalid configuration, settings timeout, unexpected layout,
or extra actuator/alert in the device section retains HA's native controls.
Revalidate the adapter before enabling it for another HA version.

Install the bundle through HACS, then load it globally so a direct visit to
Home works without opening a Lovelace dashboard first:

```yaml
frontend:
  # Keep any existing frontend settings, including themes.
  extra_module_url:
    - /hacsfiles/ha-room-outlet-card/ha-room-outlet-card.js?home-bootstrap
```

This one-time frontend setting needs a Core restart. The stable bootstrap
loads a fresh URL of the installed HACS bundle on each page load, avoiding
HACS's month-long browser cache. Future HACS bundle upgrades do not require
editing that URL. The normal HACS Lovelace resource remains registered too;
both registration and the generator hook are idempotent.
The normal Lovelace resource alone only registers the card; it does not patch
Home or request any extension settings. The global bootstrap is the explicit
opt-in to installing the hook.

An administrator must explicitly save configuration using HA's WebSocket API:

```json
{
  "type": "frontend/set_system_data",
  "key": "room_outlet_card",
  "value": {
    "schema_version": 1,
    "enabled": true,
    "outlets": [
      {
        "entity": "switch.office_desk_outlet",
        "name": "Desk Outlet",
        "power": "sensor.office_desk_outlet_power",
        "energy": "sensor.office_desk_outlet_shelly_energy"
      }
    ]
  }
}
```

This is frontend configuration, not a new HA integration, entity or database.
It is readable by regular authenticated users, so the Home view also works for
non-admin household members. Lists are never inferred from areas or guessed
from entity names. Refresh the browser after changing this configuration.
For rollback, save the same value with `enabled: false` and refresh. Removing
the global frontend URL disables automatic loading after the next Core restart.
Leave the separate normal Lovelace resource installed for editable dashboards.

Read-only browser diagnostics are available at `window.roomOutletCardHome`:
version, hook status, and the last 20 area generation results. No states, tokens
or commands are recorded. The extension itself only reads settings and modifies
generated card configuration; it never calls services or operates devices.

## Development

```sh
npm ci
npm test
npm run build
npm run check
```

Serve this directory over HTTP (ES modules cannot be opened through `file://`)
and open `preview/index.html` for a mocked Home Assistant preview. It has no
connection to real devices. Browser checks are in `tests/browser-check.mjs`
for Playwright CLI `run-code --filename`. Publish the built
`dist/ha-room-outlet-card.js` as a GitHub release asset, then install via HACS;
never patch a live Home Assistant bundle.

`preview/index.html?home` exercises the generator adapter on isolated fixtures;
`?home&bootstrap` additionally tests the global loader. These are mocked previews,
not proof of an authenticated live Home render. Browser checks for this path
are in `tests/home-browser-check.mjs`.
