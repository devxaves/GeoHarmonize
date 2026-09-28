import type React from "react"
import type { Metadata } from "next"
import { Noto_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import Link from "next/link"
import { LanguageProvider } from "@/components/LanguageProvider"
import NavBar from "@/components/NavBar"
import Logo, { LogoMark } from "@/components/Logo"
import { Suspense } from "react"

/* ── Font Configuration ────────────────────────────────────────── */
// Noto Sans covers Latin + Devanagari, so the Hindi UI renders in the same face.
const noto = Noto_Sans({
  subsets: ["latin", "devanagari"],
  variable: "--font-noto",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "GeoSync — Geospatial Land Record Integration",
  description:
    "GeoSync consolidates drone imagery, cadastral maps, revenue records and GNSS survey data into a single, confidence-scored parcel database with human review and a complete audit trail.",
  applicationName: "GeoSync",
  icons: {
    icon: "/geosync-mark.svg",
    shortcut: "/geosync-mark.svg",
    apple: "/geosync-mark.svg",
  },
  keywords: [
    "GeoSync",
    "land record integration",
    "geospatial harmonization",
    "ULPIN",
    "cadastral maps",
    "drone survey",
    "GIS",
    "land records modernization",
  ],
}

export const viewport = {
  themeColor: "#0B6BC2",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${noto.variable} ${plexMono.variable} font-sans min-h-dvh bg-background text-foreground antialiased`}
      >
          <LanguageProvider>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-3" role="status">
                  <LogoMark size={40} />
                  <div className="text-sm font-medium text-muted-foreground">Loading GeoSync…</div>
                </div>
              </div>
            }
          >
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <NavBar />
            <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-56px)] focus:outline-none">{children}</main>

            {/* ── Footer ──────────────────────────────────────── */}
            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="max-w-sm">
                    <Logo size={28} />
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      Geospatial land record integration — one confidence-scored parcel database from drone,
                      cadastral, revenue and GNSS sources.
                    </p>
                  </div>
                  <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
                    <Link href="/atlas" className="text-slate-600 hover:text-brand-700 hover:underline">Review Atlas</Link>
                    <Link href="/docs" className="text-slate-600 hover:text-brand-700 hover:underline">Documentation</Link>
                    <Link href="/upload" className="text-slate-600 hover:text-brand-700 hover:underline">Data Ingestion</Link>
                    <Link href="/archive" className="text-slate-600 hover:text-brand-700 hover:underline">Audit Archive</Link>
                    <Link href="/dashboard" className="text-slate-600 hover:text-brand-700 hover:underline">Dashboard</Link>
                    <Link href="/admin" className="text-slate-600 hover:text-brand-700 hover:underline">Administration</Link>
                  </nav>
                </div>
                <div className="mt-8 pt-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-500">
                  <span>© {new Date().getFullYear()} GeoSync. All rights reserved.</span>
                  <span>Designed to WCAG 2.1 AA · Best viewed in the latest Chrome, Edge, Firefox or Safari</span>
                </div>
              </div>
            </footer>
          </Suspense>
          </LanguageProvider>
      </body>
    </html>
  )
}
