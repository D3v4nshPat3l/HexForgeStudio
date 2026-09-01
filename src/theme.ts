/**
 * Theme.
 *
 * The console is dark only. A light variant existed and was removed: this is a tool
 * for long analysis sessions against dense hex, and the background field the
 * workstation runs is a dark ground whose streaks are made by over-brightening what
 * shows through -- there is no honest light equivalent of it.
 *
 * Applied once at startup so the document still declares its colour scheme to the
 * browser, which is what stops form controls and scrollbars rendering light.
 */
export function applyTheme(): void {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.style.colorScheme = "dark";
}
