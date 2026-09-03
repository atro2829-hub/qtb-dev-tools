"use client";

import dynamic from "next/dynamic";

/**
 * The app is a fully client-side SPA (state in zustand, data via /api).
 * Loading the shell with `ssr: false` keeps the entire view tree
 * (recharts, framer-motion, all 16 views) OUT of the server bundle, which
 * is required to stay under the Cloudflare Workers 3MB free-plan size limit.
 */
const AppShell = dynamic(() => import("@/components/qtb/AppShell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-lg font-black tracking-tight text-white">
          Q
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-neutral-200">
          <div className="qtb-loading-bar h-full w-1/2 rounded-full bg-neutral-900" />
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  return <AppShell />;
}
