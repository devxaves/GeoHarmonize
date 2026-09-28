import type React from "react"
import type { Metadata } from "next"
import { Sora, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import "./globals.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import { AuthProvider } from "@/components/AuthProvider"
import { LanguageProvider } from "@/components/LanguageProvider"
import NavBar from "@/components/NavBar"
import { Suspense } from "react"

/* ── Google Font Configuration ─────────────────────────────────── */
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "GeoHarmonize — AI-Assisted Geospatial Land Record Integration",
  description:
    "AI-assisted multi-source geospatial land record integration platform. Harmonizes drone imagery, cadastral maps, revenue records, and GNSS data into a single, confidence-scored parcel database. Department of Land Resources (DoLR), Ministry of Rural Development, Government of India.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "GeoHarmonize",
    "land record integration",
    "geospatial harmonization",
    "ULPIN",
    "cadastral maps",
    "drone imagery",
    "PostGIS",
    "DoLR",
    "Ministry of Rural Development",
    "Digital India",
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${jakarta.variable} ${spaceGrotesk.variable} font-sans min-h-dvh bg-background text-foreground antialiased`}
      >
        <AuthProvider>
          <LanguageProvider>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 animate-pulse" />
                    <div className="absolute inset-1 rounded-xl bg-white flex items-center justify-center">
                      <span className="text-lg font-black text-orange-600">G</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground animate-pulse font-heading">
                    Loading GeoHarmonize…
                  </div>
                </div>
              </div>
            }
          >
            <NavBar />
            <main className="min-h-[calc(100vh-56px)]">{children}</main>

            {/* ── Footer ──────────────────────────────────────── */}
            <footer className="relative border-t border-border bg-white">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-300/40 to-transparent" />
              <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Left: Brand */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 shadow-sm">
                      <span className="text-xs font-black text-white">G</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-heading font-bold text-foreground tracking-tight">
                        <span className="text-orange-600">Geo</span>
                        <span className="text-amber-600">Harmonize</span>
                      </span>
                      <span className="text-border">·</span>
                      <span className="text-muted-foreground">AI-Assisted Land Record Integration Platform</span>
                    </div>
                  </div>

                  {/* Right: Government attribution */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Dept. of Land Resources</span>
                    <span className="text-border">·</span>
                    <span>Ministry of Rural Development</span>
                    <span className="text-border">·</span>
                    <span className="font-semibold text-foreground/60">Government of India</span>
                  </div>
                </div>
              </div>
            </footer>
          </Suspense>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
