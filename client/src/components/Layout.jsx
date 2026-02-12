import { useEffect, useState, useRef } from 'react';
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

    // Navigation Order for animation direction
    // Lists (/) -> Menu -> Recipes -> Products -> Settings
    const navOrder = ['/', '/menu', '/recipes', '/products', '/settings'];
    const getNavIndex = (path) => {
        // Handle detail paths or unknown paths by defaulting to a logical parent or -1
        if (path.startsWith('/lists/')) return 0; // Treat list details as part of "Lists" tab
        if (path.startsWith('/shared/')) return -1;
        return navOrder.indexOf(path);
    };

    const [direction, setDirection] = useState(0);
    const prevPathRef = useRef(location.pathname);
    const prevIndexRef = useRef(getNavIndex(location.pathname));

    useEffect(() => {
        setEditMode('view');
    }, [location.pathname, setEditMode]);

    useEffect(() => {
        const currIndex = getNavIndex(location.pathname);
        const prevIndex = prevIndexRef.current;

        if (currIndex !== -1 && prevIndex !== -1 && currIndex !== prevIndex) {
            setDirection(currIndex > prevIndex ? 1 : -1);
        } else {
            setDirection(0); // Default or cross-level navigation (fade)
        }

        prevPathRef.current = location.pathname;
        prevIndexRef.current = currIndex;
    }, [location.pathname]);

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

    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? 20 : direction < 0 ? -20 : 0,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: { duration: 0.3, type: "spring", stiffness: 300, damping: 30 }
        },
        exit: (direction) => ({
            x: direction > 0 ? -20 : direction < 0 ? 20 : 0,
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.2 }
        })
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            <header
                className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border transition-all"
                style={{
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingLeft: 'env(safe-area-inset-left)',
                    paddingRight: 'env(safe-area-inset-right)'
                }}
            >
                <div className="max-w-7xl mx-auto pr-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 h-full overflow-hidden">
                        <div className="w-20 h-20 -mt-2 self-start flex items-center justify-center overflow-visible z-50 flex-shrink-0">
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

                        <div className="relative h-8 flex items-center">
                            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                                <motion.span
                                    key={location.pathname}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    className="text-xl font-bebas tracking-wider text-foreground whitespace-nowrap block"
                                >
                                    {getPageTitle()}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-end items-center gap-2">
                        {/* Sync Indicator */}
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

                        <EditModeSelector editMode={editMode} setEditMode={setEditMode} />

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-all flex-shrink-0"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-2">
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
