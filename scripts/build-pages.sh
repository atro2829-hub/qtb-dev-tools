#!/usr/bin/env bash
# QTB DEV TOOLS — build the static UI preview for GitHub Pages.
#
# The full-stack app needs a Node server (see DEPLOYMENT.md). This script
# produces a static export of the client UI (landing page, views, design)
# WITHOUT API routes — fetches fail gracefully and the landing renders.
#
# Usage: scripts/build-pages.sh          (from the repo root)
# Output: ./out/                         (deploy this folder)
set -euo pipefail
cd "$(dirname "$0")/.."

REPO_BASE="qtb-dev-tools"
WORK="build-pages"

rm -rf "$WORK" out
mkdir -p "$WORK"

# 1. Copy the project (no runtime artifacts).
tar cf - \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=db --exclude=tool-results --exclude=agent-ctx \
  --exclude=dev.log --exclude=.env --exclude="$WORK" \
  --exclude=out --exclude=src/app/api \
  --exclude=tests --exclude=examples --exclude=skills \
  --exclude=mini-services --exclude=download \
  . | (cd "$WORK" && tar xf -)

# 2. Static-export Next config with the project-site basePath.
cat > "$WORK/next.config.ts" <<EOF
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: false,
  basePath: "/$REPO_BASE",
  assetPrefix: "/$REPO_BASE/",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
EOF

# 3. Install deps + build.
cd "$WORK"
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile
  bunx next build
else
  npm ci
  npx next build
fi

# 4. Collect the export.
cd ..
mv "$WORK/out" out
touch out/.nojekyll
echo "✓ Static Pages build ready in ./out/"
