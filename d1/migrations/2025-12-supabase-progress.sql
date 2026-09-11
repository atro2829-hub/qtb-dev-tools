-- QTB DEV TOOLS — D1 migration (run once per environment)
-- Adds: live run progress on ToolJob + Supabase cloud config on SiteConfig

ALTER TABLE "ToolJob" ADD COLUMN "runKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ToolJob" ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ToolJob" ADD COLUMN "stage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ToolJob" ADD COLUMN "resultUrl" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "ToolJob_runKey_idx" ON "ToolJob"("runKey");

ALTER TABLE "SiteConfig" ADD COLUMN "supabaseUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN "supabaseServiceKey" TEXT NOT NULL DEFAULT '';
