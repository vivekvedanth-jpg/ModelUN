import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const SITE_URL = "https://letsmun.com";
const SITE_NAME = "Let's MUN";
const DESCRIPTION =
  "A learning platform for student diplomats. Watch lessons, study resources, time your caucuses, and practice public speaking through Model United Nations.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Let's MUN — Learn the Art of Diplomacy",
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "Model United Nations",
    "MUN",
    "MUN training",
    "MUN for beginners",
    "learn Model UN",
    "public speaking for students",
    "diplomacy skills",
    "resolution writing",
    "rules of procedure",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Let's MUN — Learn the Art of Diplomacy",
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "Let's MUN" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Let's MUN — Learn the Art of Diplomacy",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
