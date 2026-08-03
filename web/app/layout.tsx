import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../../electron/src/renderer/src/styles.css";
import "../../electron/src/renderer/src/accountDialog.css";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Looper",
  description: "A fast, live calculation sheet for exploring numbers over time.",
  title: "Looper"
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  viewportFit: "cover",
  themeColor: [
    { color: "#171717", media: "(prefers-color-scheme: dark)" },
    { color: "#f7f7f7", media: "(prefers-color-scheme: light)" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
