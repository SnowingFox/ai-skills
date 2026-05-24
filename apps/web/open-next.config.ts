import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

export default defineCloudflareConfig({
  // Activate after enabling R2 in Cloudflare Dashboard and creating the bucket:
  //   wrangler r2 bucket create ai-skills-next-cache
  // Then uncomment:
  // incrementalCache: r2IncrementalCache,
});
