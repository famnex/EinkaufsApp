import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 backdrop-blur-sm"
            aria-label="Toggle theme"
        >
            <motion.div
                initial={false}
                animate={{ rotate: theme === 'dark' ? 180 : 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </motion.div>
        </button>
    );
}
