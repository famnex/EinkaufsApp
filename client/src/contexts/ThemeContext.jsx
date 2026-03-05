import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    });
    const [forceTheme, setForceTheme] = useState(null);

    useEffect(() => {
        const root = window.document.documentElement;
        const activeTheme = forceTheme || theme;

        root.classList.remove('light', 'dark');
        root.classList.add(activeTheme);
        root.style.colorScheme = activeTheme;

        // Only save user preference if we aren't currently forcing a temporary theme
        if (!forceTheme) {
            localStorage.setItem('theme', theme);
        }
    }, [theme, forceTheme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, forceTheme, setForceTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
