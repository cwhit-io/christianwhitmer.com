/**
 * server.ts
 *
 * Entry point. Loads config (which validates env vars and exits on failure),
 * then starts the Fastify server.
 */

import { config } from "./config.js";
import { buildApp } from "./app.js";

const app = buildApp();

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
