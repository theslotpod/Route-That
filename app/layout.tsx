import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "The Slot Pod",
  description: "NFL podcast and interactive football games. Play Route-That, explore PlayMap analytics.",
  keywords: ["NFL", "football", "podcast", "Route-That", "PlayMap", "analytics"],
  openGraph: {
    title: "The Slot Pod",
    description: "NFL podcast, Route-That game, and PlayMap analytics.",
    siteName: "The Slot Pod",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main style={{ minHeight: "calc(100vh - 56px)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
