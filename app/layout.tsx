import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

export const metadata: Metadata = {
  title: { default: "Doctor Queue — Know your turn", template: "%s | Doctor Queue" },
  description: "Find clinics, check live token status, and spend less time waiting in the clinic.",
  applicationName: "Doctor Queue",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Doctor Queue" }
};

export const viewport: Viewport = {
  themeColor: "#147d55",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PwaRegistration /></body></html>;
}