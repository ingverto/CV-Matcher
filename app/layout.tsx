import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "CV Matcher",
  description: "Matcha CV mot jobbannons med AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}