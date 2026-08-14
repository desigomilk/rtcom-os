import { createContext, useContext, useState, type ReactNode } from "react";
import { STRINGS, type StringKey } from "./strings";

type Language = "en" | "hi";

interface LanguageState {
  language: Language;
  toggle: () => void;
  t: (key: StringKey) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("hi");

  function toggle() {
    setLanguage((l) => (l === "hi" ? "en" : "hi"));
  }
  function t(key: StringKey) {
    return STRINGS[key][language];
  }

  return (
    <LanguageContext.Provider value={{ language, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
