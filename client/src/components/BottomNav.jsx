import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, List, Package, CalendarRange, UtensilsCrossed, MoreHorizontal, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { id: 'dashboard', icon: List, path: '/', label: 'Listen' },
        { id: 'menu', icon: CalendarRange, path: '/menu', label: 'Menüplan' },
        { id: 'recipes', icon: UtensilsCrossed, path: '/recipes', label: 'Rezepte' },
        { id: 'community', icon: BookOpen, path: '/community-cookbooks', label: 'Community' },
        { id: 'products', icon: Package, path: '/products', label: 'Produkte' },
        { id: 'settings', icon: Settings, path: '/settings', label: 'Optionen' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 dark:bg-[#4a3f3f]/90 backdrop-blur-xl border-t border-border h-20 flex items-center justify-around px-4 shadow-xl transition-colors duration-300">
            {tabs.map((tab) => {
                const active = isActive(tab.path);
                return (
                    <button
                        key={tab.id}
                        onClick={() => navigate(tab.path)}
                        className="relative flex flex-col items-center justify-center gap-1 w-16 h-16 group outline-none"
                    >
                        {active && (
                            <motion.div
                                layoutId="nav-active-bg"
                                className="absolute inset-0 bg-primary rounded-2xl shadow-lg shadow-primary/20"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <tab.icon
                            size={22}
                            className={cn(
                                "relative z-10 transition-all duration-300",
                                active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground"
                            )}
                        />
                        <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest relative z-10 transition-colors duration-300 hidden sm:block",
                            active ? "text-primary-foreground" : "text-muted-foreground"
                        )}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
