"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

interface LanguageContextType {
  language: string;
  setLanguage: (code: string) => void;
  availableLanguages: LanguageOption[];
  t: (key: string, fallback?: string) => string;
}

// ── Translations ──────────────────────────────────────────────────────────────
const translations: Record<string, Record<string, string>> = {
  en: {
    // Government strip
    "govt.india": "भारत सरकार | Government of India",
    "govt.mord": "Ministry of Rural Development",
    "govt.dolr": "Department of Land Resources (DoLR)",
    "govt.helpline": "Helpline",

    // Navigation
    "nav.home": "Home",
    "nav.atlas": "Web-GIS Atlas",
    "nav.upload": "Ingest Data",
    "nav.analytics": "Analytics",
    "nav.archive": "Audit Trail",
    "nav.tools": "Governance Tools",
    "nav.ocr": "Data Ingestion & OCR",
    "nav.admin": "Admin Console",
    "nav.ulpinSearch": "ULPIN Search",
    "nav.login": "Official Login",
    "nav.signOut": "Sign Out",
    "nav.atlas": "Review Atlas",

    // Hero / Search
    "hero.searchLabel": "Spatial Conflict Review",

    // Footer / Misc
    "footer.modules": "Core Modules",
  },
  hi: {
    // Government strip
    "govt.india": "भारत सरकार | Government of India",
    "govt.mord": "ग्रामीण विकास मंत्रालय",
    "govt.dolr": "भूमि संसाधन विभाग (DoLR)",
    "govt.helpline": "हेल्पलाइन",

    // Navigation
    "nav.home": "होम",
    "nav.atlas": "वेब-जीआईएस एटलस",
    "nav.upload": "डेटा अपलोड",
    "nav.analytics": "विश्लेषण",
    "nav.archive": "ऑडिट ट्रेल",
    "nav.tools": "शासन उपकरण",
    "nav.ocr": "डेटा अंतर्ग्रहण और OCR",
    "nav.admin": "व्यवस्थापक कंसोल",
    "nav.ulpinSearch": "ULPIN खोज",
    "nav.login": "आधिकारिक लॉगिन",
    "nav.signOut": "साइन आउट",
    "nav.atlas": "स्पेशियल कॉन्फ्लिक्ट समीक्षा",

    // Hero / Search
    "hero.searchLabel": "स्पेशियल कॉन्फ्लिक्ट समीक्षा",

    // Footer / Misc
    "footer.modules": "मुख्य मॉड्यूल",
  },
};

// ── Available Languages ────────────────────────────────────────────────────────
const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "EN" },
  { code: "hi", label: "Hindi", nativeLabel: "हि" },
];

// ── Context ───────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  availableLanguages: AVAILABLE_LANGUAGES,
  t: (_key: string, fallback?: string) => fallback ?? "",
});

export function useLanguage() {
  return useContext(LanguageContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>("en");

  const setLanguage = useCallback((code: string) => {
    if (AVAILABLE_LANGUAGES.some((l) => l.code === code)) {
      setLanguageState(code);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return translations[language]?.[key] ?? fallback ?? key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        availableLanguages: AVAILABLE_LANGUAGES,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
