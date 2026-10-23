import type { Metadata } from "next";
import "./globals.css";
import LiveRefresh from "@/components/LiveRefresh";

export const metadata: Metadata = {
  title: "SQUADINO Ops",
  description: "Squadino platform management console",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <LiveRefresh />
      </body>
    </html>
  );
}
