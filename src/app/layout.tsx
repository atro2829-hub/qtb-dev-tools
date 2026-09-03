import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qutaibiv.com"),
  title: "QTB DEV TOOLS — Professional Online Tools",
  description:
    "AI background removal, file conversion, document translation & PDF tools by QTB DEV. Fast, secure, no installs.",
  keywords: [
    "QTB DEV TOOLS",
    "background remover",
    "file converter",
    "AI translation",
    "PDF merge",
    "PDF split",
    "online tools",
  ],
  authors: [{ name: "QTB DEV" }],
  openGraph: {
    title: "QTB DEV TOOLS — Professional Online Tools",
    description:
      "AI background removal, file conversion, document translation & PDF tools. Fast, secure, no installs.",
    siteName: "QTB DEV TOOLS",
    type: "website",
    url: "https://qutaibiv.com",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "QTB DEV TOOLS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QTB DEV TOOLS — Professional Online Tools",
    description:
      "AI background removal, file conversion, document translation & PDF tools. Fast, secure, no installs.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QTB TOOLS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoKufiArabic.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
