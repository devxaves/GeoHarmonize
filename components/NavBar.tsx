"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";
import {
  MapPin,
  Upload,
  GitBranch,
  AlertTriangle,
  BarChart3,
  Archive,
  Landmark,
  Settings,
  LogOut,
  LogIn,
  User,
  PhoneCall,
  Home,
  Shield,
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
  const { user, loading, logout } = useAuth();
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

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const primaryLinks = [
    { href: "/landing", label: t("nav.home", "Home"), icon: Home },
    { href: "/atlas", label: t("nav.atlas", "Review Atlas"), icon: MapPin },
    { href: "/upload", label: t("nav.upload", "Ingest Data"), icon: Upload },
    { href: "/dashboard", label: t("nav.analytics", "Dashboard"), icon: BarChart3 },
    { href: "/archive", label: t("nav.archive", "Archive"), icon: Archive },
    ...(user?.role === "admin"
      ? [{ href: "/admin", label: t("nav.admin", "Admin"), icon: Settings }]
      : []),
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
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity flex-shrink-0 group"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:scale-105 transition-all">
                <span className="text-sm font-black text-white drop-shadow-sm font-heading">G</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-heading font-extrabold tracking-tight">
                  <span className="text-orange-600">Geo</span>
                  <span className="text-amber-600">Harmonize</span>
                </span>
                <span className="text-[9px] font-bold font-label px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 hidden xs:inline-block">
                  DoLR · SIH 26013
                </span>
              </div>
              <p className="text-[9px] font-medium text-muted-foreground hidden md:block tracking-wide font-label">
                AI Multi-Source Geospatial Land Record Integration
              </p>
            </div>
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
                  className={`relative flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all whitespace-nowrap group ${
                    isActive
                      ? "bg-orange-50 text-orange-800 font-bold"
                      : "text-foreground/70 hover:text-orange-700 hover:bg-orange-50/60"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-orange-600" : "text-foreground/50 group-hover:text-orange-500"}`} />
                  <span>{link.label}</span>
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-orange-400 to-amber-400" />
                  )}
                </Link>
              );
            })}

          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Auth */}
            <div className="border-l border-slate-200 pl-2 sm:pl-3 flex items-center gap-1.5">
              {loading ? (
                <div className="h-7 w-7 rounded-xl skeleton" />
              ) : user ? (
                <div className="flex items-center gap-1.5">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span className="max-w-[90px] truncate font-medium text-slate-800">{user.name || user.email}</span>
                    <span
                      className={`text-[9px] font-bold font-label px-1.5 py-0.5 rounded-full ${
                        user.role === "admin"
                          ? "bg-orange-100 text-orange-800 border border-orange-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {user.role === "admin" ? "ADMIN" : "CITIZEN"}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    title={t("nav.signOut", "Sign Out")}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 p-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t("nav.login", "Official Login")}</span>
                </Link>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
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
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/50">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                <Globe2 className="w-3.5 h-3.5 text-orange-500" />
                भाषा / Language:
              </span>
              <div className="flex items-center gap-1">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      language === lang.code
                        ? "bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm"
                        : "bg-white text-foreground/70 border border-border hover:bg-muted"
                    }`}
                  >
                    {lang.nativeLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Atlas Search */}
            <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-200/60">
              <div className="text-xs font-bold text-orange-900 mb-1 flex items-center gap-1.5 font-heading">
                <Search className="w-3.5 h-3.5 text-orange-600" />
                Spatial Conflict Review
              </div>
              <p className="text-[11px] text-orange-700 mb-2">
                Review harmonized parcel boundaries, confidence scores & audit trail
              </p>
              <Link
                href="/atlas"
                className="inline-flex items-center justify-center w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                Open Review Atlas
              </Link>
            </div>

            {/* Core Navigation Links */}
            <div className="space-y-1">
              <div className="section-label px-2 py-1">
                {t("footer.modules", "Core Modules")}
              </div>
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-orange-50 text-orange-800 font-bold"
                        : "text-foreground/70 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-orange-600" : "text-foreground/40"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>



            {/* Mobile Auth */}
            <div className="pt-2 border-t border-border/40">
              {user ? (
                <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{user.name || user.email}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-label">{user.role} Account</div>
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-1"
                  >
                    <LogOut className="h-3 w-3" />
                    {t("nav.signOut", "Sign Out")}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl btn-primary text-sm"
                >
                  <Shield className="h-4 w-4" />
                  {t("nav.login", "Official Department Login")}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
