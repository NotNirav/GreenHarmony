import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { MobileTabBar } from "@/components/MobileTabBar";
import { RouteInsightToast } from "@/components/RouteInsightToast";
import { SiteFooter } from "@/components/SiteFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { stats } from "@/lib/data";
import "./globals.css";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--nf-body", display: "swap" });
const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--nf-deva",
  display: "swap",
  weight: ["400", "500", "600"],
});

const DESCRIPTION =
  `Find plants that actually thrive on your Indian balcony, terrace or windowsill. ${stats.plants} nursery-available plants with Hindi and Marathi names, care tips and seasonal calendars.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${body.variable} ${deva.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <SiteHeader />
        <main className="pb-tabbar">{children}</main>
        <SiteFooter />
        <RouteInsightToast />
        <MobileTabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
