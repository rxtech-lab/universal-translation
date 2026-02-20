import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://universal-translation.rxlab.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Universal Translation — AI-Powered Software Localization",
    template: "%s | Universal Translation",
  },
  description:
    "Translate Xcode .xcloc catalogs, .srt subtitles, .po gettext files, Markdown, and Word documents with AI. Context-aware, terminology-consistent, and built for developers.",
  keywords: [
    "software localization",
    "AI translation",
    "xcloc translation",
    "srt translation",
    "po file translation",
    "gettext translation",
    "Xcode localization",
    "LLM translation",
    "document translation",
    "subtitle translation",
  ],
  authors: [{ name: "RxLab" }],
  creator: "RxLab",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Universal Translation",
    title: "Universal Translation — AI-Powered Software Localization",
    description:
      "Translate .xcloc, .srt, .po, .md, .docx and more with AI. Context-aware translations with terminology consistency — built for developers and translators.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Universal Translation — AI-Powered Software Localization",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Universal Translation — AI-Powered Software Localization",
    description:
      "Translate .xcloc, .srt, .po, .md, .docx and more with AI. Context-aware, terminology-consistent localization for developers.",
    images: ["/og.png"],
    creator: "@rxlab",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
