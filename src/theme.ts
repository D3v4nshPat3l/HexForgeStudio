export type ThemeName = "dark" | "light";

const STORAGE_KEY = "hexforge.theme";

/**
 * Theme persistence.
 *
 * Dark is the product default because the workstation is designed for long analysis
 * sessions, but an explicit stored choice always wins, and a first-time visitor whose
 * system asks for light gets light.
 */
export function resolveInitialTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Private-mode or blocked storage: fall through to the system preference.
  }
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persistence is best-effort; the applied theme still holds for this session.
  }
}

export function toggleTheme(current: ThemeName): ThemeName {
  const next: ThemeName = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
