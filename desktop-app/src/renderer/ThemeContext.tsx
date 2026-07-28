import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'nebula' | 'aurora' | 'sakura' | 'sunset';

export const THEMES: { id: Theme; name: string; type: 'dark' | 'light'; description: string }[] = [
  { id: 'nebula', name: 'Nebula', type: 'dark', description: 'Deep space, stars, cyan & purple' },
  { id: 'aurora', name: 'Aurora', type: 'dark', description: 'Northern lights, green & teal' },
  { id: 'sakura', name: 'Sakura', type: 'light', description: 'Cherry blossom, pink & rose' },
  { id: 'sunset', name: 'Sunset', type: 'light', description: 'Golden hour, amber & orange' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'nebula', setTheme: () => {}, isDark: true });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('tg-theme') as Theme;
    if (['nebula', 'aurora', 'sakura', 'sunset'].includes(saved)) return saved;
    return 'nebula';
  });

  const isDark = theme === 'nebula' || theme === 'aurora';

  useEffect(() => {
    localStorage.setItem('tg-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
