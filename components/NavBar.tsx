"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import Logo from "./Logo";
import {
  MapPin,
  Upload,
  GitBranch,
  AlertTriangle,
  BarChart3,
  Archive,
  Landmark,
  Settings,
  PhoneCall,
  Home,
  Search,
  Menu,
  X,
  ChevronDown,
  Layers,
  Globe2,
  Check,
  BookOpen,
} from "lucide-react";

export default function NavBar() {
  const { language, setLanguage, availableLanguages, t } = useLanguage();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setToolsDropdownOpen(false);
    setLangDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setToolsDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const primaryLinks = [
    { href: "/landing", label: t("nav.home", "Home"), icon: Home },
    { href: "/atlas", label: t("nav.atlas", "Review Atlas"), icon: MapPin },
    { href: "/upload", label: t("nav.upload", "Ingest Data"), icon: Upload },
    { href: "/dashboard", label: t("nav.analytics", "Dashboard"), icon: BarChart3 },
    { href: "/archive", label: t("nav.archive", "Archive"), icon: Archive },
    { href: "/admin", label: t("nav.admin", "Admin"), icon: Settings },
  ];

  const currentLangObj = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  return (
    <div className="sticky top-0 z-50 bg-white shadow-xs">


      {/* ── 2. Main Navigation Bar (100% Solid White Opaque) ─────────── */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 py-2.5 gap-2 sm:gap-4">
          {/* Brand */}
          <Link
            href="/landing"
            className="flex items-center flex-shrink-0 rounded-md"
            aria-label="GeoSync home"
          >
            <Logo size={34} tagline="Land Record Integration Platform" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-0.5">
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href !== "/landing" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-md transition-colors whitespace-nowrap group ${
                    isActive
                      ? "text-brand-700 bg-brand-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span>{link.label}</span>
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute -bottom-[11px] left-2 right-2 h-0.5 bg-brand-600" />
                  )}
                </Link>
              );
            })}

          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            <Link
              href="/upload"
              className="btn-primary hidden sm:inline-flex text-sm py-1.5 px-3 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t("nav.uploadCta", "Upload data")}</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* ── 3. Mobile Navigation Drawer (100% Solid White) ─────────── */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-4 shadow-2xl animate-fade-in max-h-[85vh] overflow-y-auto">
            {/* Mobile Language Switcher */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border/50">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                <Globe2 className="w-3.5 h-3.5 text-brand-600" />
                भाषा / Language:
              </span>
              <div className="flex items-center gap-1">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      language === lang.code
                        ? "bg-brand-600 text-white"
                        : "bg-white text-foreground/70 border border-border hover:bg-muted"
                    }`}
                  >
                    {lang.nativeLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Navigation Links */}
            <div className="space-y-1">
              <div className="section-label px-2 py-1">
                {t("footer.modules", "Navigation")}
              </div>
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-brand-50 text-brand-800"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

          </div>
        )}
      </header>
    </div>
  );
}
