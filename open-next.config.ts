// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// All routes in this app are force-dynamic and the UI is a single client-side
// SPA route, so the default (dummy) incremental cache is sufficient — no R2
// cache binding needed.
export default defineCloudflareConfig({});
