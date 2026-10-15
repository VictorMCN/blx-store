import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProvider } from "@/components/store-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BLX Store",
    template: "%s | BLX Store",
  },
  description:
    "A portfolio e-commerce platform focused on secure payments, AI-assisted shopping, and production-inspired engineering practices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <StoreProvider>
          <div className="flex min-h-screen flex-col bg-white text-slate-950">
            <SiteHeader />

            <div className="flex-1">
              {children}
            </div>

            <SiteFooter />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
