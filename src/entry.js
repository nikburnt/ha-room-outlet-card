import { registerCard } from "./card.js";
import { installHomeExtension } from "./home.js";

// The stable global URL is a bootstrap only. Always load the installed bundle
// with a fresh URL so HACS updates cannot be masked by its month-long cache.
const url = new URL(import.meta.url);
if (url.searchParams.has("home-bootstrap")) {
  url.searchParams.delete("home-bootstrap");
  url.searchParams.set("home-build", String(Date.now()));
  try { await import(url.href); }
  catch (error) { console.warn("Room Outlet Card Home could not load: " + error.message); }
} else {
  registerCard();
  if (url.searchParams.has("home-build")) installHomeExtension();
}
