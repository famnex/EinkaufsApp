import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import { useTheme } from '../contexts/ThemeContext';
import { Edit3, Eye, Sun, Moon, List, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
    const { user } = useAuth();
    const { editMode, setEditMode } = useEditMode();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    useEffect(() => {
        setEditMode('view');
    }, [location.pathname, setEditMode]);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Home';
        if (path === '/menu') return 'Menüplan';
        if (path === '/recipes') return 'Rezepte';
        if (path === '/products') return 'Produkte';
        if (path === '/settings') return 'Optionen';
        if (path.startsWith('/lists/')) return 'Liste Details';
        return 'Listenübersicht';
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <List className="text-primary-foreground" size={20} />
                        </div>
                        <span className="text-xl font-bebas tracking-wider text-foreground">{getPageTitle()}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl">
                        {[
                            { id: 'view', icon: Eye, label: 'Vorschau' },
                            { id: 'create', icon: Plus, label: 'Erstellen' },
                            { id: 'edit', icon: Edit3, label: 'Bearbeiten' },
                            { id: 'delete', icon: Trash2, label: 'Löschen' }
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setEditMode(mode.id)}
                                className={cn(
                                    "p-2 rounded-xl transition-all flex items-center gap-2",
                                    editMode === mode.id
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                <mode.icon size={18} />
                                {editMode === mode.id && <span className="text-xs font-bold hidden md:inline">{mode.label}</span>}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-all ml-2"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={window.location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>
            <BottomNav />
        </div>
    );
}
