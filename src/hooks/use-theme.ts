import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "neuroface-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(stored);
    apply(stored);
  }, []);

  const update = useCallback((next: Theme) => {
    setTheme(next);
    localStorage.setItem(KEY, next);
    apply(next);
  }, []);

  return { theme, setTheme: update };
}
