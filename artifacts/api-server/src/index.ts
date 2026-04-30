// Force dev side-effects off by default in this Replit environment so the
// imported SkyPanel app boots cleanly without external integrations.
process.env.STARTUP_SIDE_EFFECTS_ENABLED ??= "false";
process.env.NODE_ENV ??= "development";
process.env.JWT_SECRET ??=
  "dev-only-jwt-secret-change-in-production-32chars-min";

import app from "./api/app.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`SkyPanel API listening on port ${port}`);
});
