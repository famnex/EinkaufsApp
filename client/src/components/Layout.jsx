import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { Edit3, Eye, Sun, Moon, List, Plus, Trash2, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';
import EditModeSelector from './EditModeSelector';

export default function Layout({ children }) {
    const { user } = useAuth();
    const { editMode, setEditMode } = useEditMode();
    const { theme, toggleTheme } = useTheme();
    const { pendingChanges, isSyncing, isOffline } = useSync();
    const location = useLocation();

    useEffect(() => {
        setEditMode('view');
    }, [location.pathname, setEditMode]);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Listen';
        if (path === '/menu') return 'Menüplan';
        if (path === '/recipes') return 'Rezepte';
        if (path === '/products') return 'Produkte';
        if (path === '/settings') return 'Optionen';
        if (path.startsWith('/lists/')) return 'Liste Details';
        return 'GabelGuru';
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            <header
                className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border transition-all"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 h-full">
                        <div className="w-20 h-20 -mt-2 -ml-4 self-start flex items-center justify-center overflow-visible z-50">
                            <img
                                src={`${import.meta.env.BASE_URL}logo_wide.png`}
                                alt="GabelGuru Logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                }}
                            />
                            <div style={{ display: 'none' }} className="text-primary">
                                <List size={20} />
                            </div>
                        </div>
                        <span className="text-xl font-bebas tracking-wider text-foreground">{getPageTitle()}</span>
                    </div>

                    <div className="flex-1 flex justify-end items-center gap-2">
                        <EditModeSelector editMode={editMode} setEditMode={setEditMode} />

                        {/* Sync Indicator - Reserved Space */}
                        <div className="w-10 h-10 flex items-center justify-center relative">
                            <AnimatePresence>
                                {(pendingChanges.length > 0 || isOffline) && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className={cn(
                                            "absolute inset-0 p-2 rounded-xl flex items-center justify-center transition-colors",
                                            isOffline ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                                        )}
                                    >
                                        {isOffline ? <CloudOff size={18} /> : (
                                            isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />
                                        )}
                                        {pendingChanges.length > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in duration-300">
                                                {pendingChanges.length}
                                            </span>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-all flex-shrink-0"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
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
