import { query } from "./api/lib/database.js";
import { EnhanceService } from "./api/services/enhanceService.js";
import { getEnhanceWebsiteOrgId } from "./api/lib/hostingEnhanceOrg.js";

async function run() {
  const { rows } = await query("SELECT * FROM hosting_subscriptions LIMIT 1");
  if (rows.length === 0) return console.log("No subscriptions found");
  const sub = rows[0];
  const orgId = getEnhanceWebsiteOrgId(sub);
  try {
    const res = await EnhanceService.getWebsiteSetting(orgId, sub.enhance_website_id, "phpIni");
    console.log("PHP INI SETTINGS:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("ERROR:", err.message, err.responseBody);
  }
  process.exit(0);
}
run();