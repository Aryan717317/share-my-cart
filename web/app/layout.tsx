import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shared Cart",
  description: "Share your Amazon cart with a family member.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
