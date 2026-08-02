import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { looperPublicOrigin } from "../../electron/src/shared/product";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Looper",
  description: "A free, open-source notebook calculator for Mac and Windows. No account, no cloud storage—just local .loop files.",
  metadataBase: new URL(looperPublicOrigin),
  title: "Looper — Think in numbers. See what changes."
};

export const viewport: Viewport = {
  colorScheme: "dark",
  viewportFit: "cover",
  themeColor: "#0b0b0d"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
