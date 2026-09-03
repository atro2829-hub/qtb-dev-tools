#!/usr/bin/env bash
# Slim Prisma artifacts for the Cloudflare Workers bundle (SQLite/D1 only):
set -e
echo "[slim-prisma] before:"
du -sm src/generated/prisma 2>/dev/null || true
# 1) native engine not usable on Workers — remove after generation
rm -f src/generated/prisma/libquery_engine-*.so.node
# 2) drop non-SQLite wasm variants from @prisma/client runtime
find node_modules/@prisma/client/runtime -name "*wasm-base64.*" ! -name "*sqlite*" -delete 2>/dev/null || true
echo "[slim-prisma] after:"
du -sm src/generated/prisma node_modules/@prisma/client/runtime 2>/dev/null || true
