# Room Outlet Card

- This repository owns the standalone HACS frontend card. Develop here, test,
  publish a release and install via HACS; never patch the installed HA bundle.
- Keep configured outlet, power and cumulative-energy entity IDs explicit.
  Do not discover entities, derive them from areas, or guess connected loads.
- Send commands only on user action and only to the exact configured switch.
  Never add room-wide shutdown or test real outlets by switching them.
- Keep relay availability independent from the two measurement sensors.
  Missing measurements are not zero; service acceptance is not relay feedback.
- Use a fixed cumulative counter when provider failover changes energy baselines.
  Do not silently alter counters, storage policies or Energy configuration.
- Keep automatic Overview automatic; do not inject cards or replace its strategy.
- Match the separate Room Light Card's Lit, HA form, theme and release patterns.
- Before release run unit tests, a clean build, bundle checks and browser checks
  at desktop/mobile widths with unknown, unavailable, error and rapid-click cases.
