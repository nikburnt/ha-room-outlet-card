import { build } from "esbuild";

await build({ entryPoints: ["src/entry.js"], bundle: true, format: "esm", target: "es2022", outfile: "dist/ha-room-outlet-card.js", minify: true });
await build({ entryPoints: ["preview/demo.js"], bundle: true, format: "esm", target: "es2022", outfile: "preview/demo.bundle.js", minify: true });
