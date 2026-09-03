"use client";

import { useAppStore } from "@/store/app-store";
import QTBLogo from "@/components/qtb/QTBLogo";

export default function Footer() {
  const config = useAppStore((s) => s.config);
  const t = useAppStore((s) => s.t);
  const organization = config?.organization || "QTB DEV";
  const devName = config?.devName || "QTB Team";
  const devEmail = config?.devEmail || "dev@qutaibiv.com";
  const supportEmail = config?.supportEmail || "support@qutaibiv.com";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto mb-5 h-0.5 w-24 rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-emerald-400" />
        <div className="flex flex-col items-center gap-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-1 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <QTBLogo size={32} logoUrl={config?.logoUrl || undefined} />
            <div className="text-xs text-neutral-500">
              <p className="font-semibold text-neutral-700">
                © {year} {organization}
              </p>
              <p>{t("landing.rights")}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 text-xs text-neutral-500 sm:items-end">
            <p>
              <span className="font-semibold text-neutral-700">{t("landing.developer")}:</span>{" "}
              {devName}
            </p>
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              <a
                href={`mailto:${devEmail}`}
                className="min-h-6 rounded font-medium text-neutral-600 underline decoration-fuchsia-300 underline-offset-2 transition-colors hover:text-fuchsia-600"
              >
                <span className="qtb-ltr-force">
                  {t("landing.dev")}: {devEmail}
                </span>
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="min-h-6 rounded font-medium text-neutral-600 underline decoration-emerald-300 underline-offset-2 transition-colors hover:text-emerald-600"
              >
                <span className="qtb-ltr-force">
                  {t("landing.support")}: {supportEmail}
                </span>
              </a>
            </p>
            <a
              href="https://qutaibiv.com"
              target="_blank"
              rel="noreferrer"
              className="rounded font-bold tracking-wide text-neutral-800 transition-colors hover:text-fuchsia-600"
            >
              qutaibiv.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
