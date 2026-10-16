# Room Outlet Card

- This repository owns the standalone HACS frontend card. Develop here, test,
  publish a release and install via HACS; never patch the installed HA bundle.
- Keep configured outlet, power and cumulative-energy entity IDs explicit.
  Do not discover entities, derive them from areas, or guess connected loads.
- Deploy one card per outlet, with room names as unframed section headings.
  Omit a top-level name for single-outlet cards to avoid a repeated card heading.
  Retain existing multi-outlet configuration support for compatibility.
- Keep the default outlet layout compact: readings below the name, no repeated
  visible On/Off label. Preserve accessible state and visible pending/fault states.
- Send commands only on user action and only to the exact configured switch.
  Never add room-wide shutdown or test real outlets by switching them.
- Keep relay availability independent from the two measurement sensors.
  Missing measurements are not zero; service acceptance is not relay feedback.
- Use a fixed cumulative counter when provider failover changes energy baselines.
  Do not silently alter counters, storage policies or Energy configuration.
- Keep automatic Overview automatic. The owner approved an opt-in Home area
  generator extension, not dashboard replacement or changes to HA's installed JS.
- Home settings live in frontend system data `room_outlet_card`, not hardcoded
  entity IDs. Transform only explicitly selected single-outlet device sections;
  preserve unrelated controls, alerts and unknown layouts as native cards.
- Global loading uses the same HACS bundle with `?home-bootstrap`; the bootstrap
  imports a fresh installed bundle URL to avoid HACS's long browser cache.
  Keep this bootstrap contract backward-compatible: an old cached bootstrap
  must still fetch a current bundle without registering its cached card code.
- Loading only the normal Lovelace resource must never install a Home hook or
  fetch Home settings. That requires the explicit global bootstrap URL.
- Validate every supported HA version. Unsupported versions, disabled/bad
  settings and unknown layouts must retain native controls. No service calls
  may be issued by the extension, including during load, refresh or fallback.
- Match the separate Room Light Card's Lit, HA form, theme and release patterns.
- Before release run unit tests, a clean build, bundle checks and browser checks
  at desktop/mobile widths with unknown, unavailable, error and rapid-click cases.
