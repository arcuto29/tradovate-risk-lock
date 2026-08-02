import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'nebula' | 'aurora' | 'midnight' | 'hologram' | 'void' | 'gold' | 'neon' | 'frost';

export const THEMES: { id: Theme; name: string; type: 'dark' | 'light'; description: string }[] = [
  { id: 'nebula', name: 'Nebula', type: 'dark', description: 'Deep space, stars, cyan & purple' },
  { id: 'aurora', name: 'Aurora', type: 'dark', description: 'Northern lights, green & teal' },
  { id: 'midnight', name: 'Midnight', type: 'dark', description: 'Pure black, red & blue, OLED' },
  { id: 'hologram', name: 'Hologram', type: 'dark', description: 'Iron Man HUD, electric blue wireframe' },
  { id: 'void', name: 'Void', type: 'dark', description: 'Pitch black, single neon green accent' },
  { id: 'gold', name: 'Gold', type: 'dark', description: 'Luxury dark, real gold & charcoal' },
  { id: 'neon', name: 'Neon', type: 'dark', description: 'Hot pink & electric purple, nightclub' },
  { id: 'frost', name: 'Frost', type: 'dark', description: 'Icy blue-white & silver on slate' },
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
    if (['nebula', 'aurora', 'midnight', 'hologram', 'void', 'gold', 'neon', 'frost'].includes(saved)) return saved;
    return 'nebula';
  });

  const isDark = true; // All themes are dark now

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
