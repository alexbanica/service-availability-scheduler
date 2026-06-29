export type Theme = 'light' | 'dark';

export class ThemeHelper {
  static readonly storageKey = 'theme';

  static getInitialTheme(): Theme {
    const stored = localStorage.getItem(ThemeHelper.storageKey);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return 'light';
    }
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    return prefersDark ? 'dark' : 'light';
  }

  static applyTheme(value: Theme): void {
    document.documentElement.dataset.theme = value;
    localStorage.setItem(ThemeHelper.storageKey, value);
  }

  static getLabel(value: Theme): string {
    return value === 'dark' ? 'Light mode' : 'Dark mode';
  }
}
