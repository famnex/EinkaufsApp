import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, List, Package, CalendarRange, UtensilsCrossed, MoreHorizontal, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { GraduationCap } from 'lucide-react';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { notificationCounts } = useAuth();
    const { setIsWelcomeOpen } = useTutorial();

    const tabs = [
        { id: 'dashboard', icon: List, path: '/', label: 'Listen', tutorialId: 'nav-lists' },
        { id: 'menu', icon: CalendarRange, path: '/menu', label: 'Menüplan', tutorialId: 'nav-planner' },
        { id: 'recipes', icon: UtensilsCrossed, path: '/recipes', label: 'Rezepte', tutorialId: 'nav-recipes' },
        { id: 'community', icon: BookOpen, path: '/community-cookbooks', label: 'Community', tutorialId: 'nav-community' },
        { id: 'tutorial', icon: GraduationCap, isAction: true, label: 'Tutorial' },
        { id: 'settings', icon: Settings, path: '/settings', label: 'Optionen', tutorialId: 'bottom-settings-tab' },
    ];

    const isActive = (path) => path && location.pathname === path;
    const activeIndex = tabs.findIndex(tab => isActive(tab.path));

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[1000] bg-card/80 backdrop-blur-xl border-t border-border h-20 shadow-xl"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
            id="bottom-nav"
        >
            <div className="max-w-7xl mx-auto h-full grid grid-cols-6 relative px-2">
                {/* Active Highlight Marker */}
                {activeIndex !== -1 && (
                    <div className="absolute inset-y-0 left-2 right-2 pointer-events-none">
                        <div className="relative w-full h-full">
                            <motion.div
                                className="absolute top-2 bottom-2 bg-primary rounded-2xl shadow-lg shadow-primary/20"
                                initial={false}
                                animate={{
                                    left: `${(activeIndex * 100) / 6}%`,
                                    width: `${100 / 6}%`
                                }}
                                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                            />
                        </div>
                    </div>
                )}

                {tabs.map((tab) => {
                    const active = isActive(tab.path);
                    return (
                        <button
                            key={tab.id}
                            id={tab.tutorialId}
                            onClick={() => tab.isAction ? setIsWelcomeOpen(true) : navigate(tab.path)}
                            className="relative flex flex-col items-center justify-center gap-1 group outline-none z-10"
                        >
                            <div className="relative">
                                <tab.icon
                                    size={22}
                                    className={cn(
                                        "relative z-10 transition-all duration-300",
                                        active ? "text-primary-foreground scale-110" : "text-muted-foreground group-hover:text-foreground",
                                        tab.isAction ? "group-hover:text-primary" : ""
                                    )}
                                />
                                {tab.id === 'settings' && notificationCounts?.total > 0 && (
                                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background z-20">
                                        {notificationCounts.total}
                                    </span>
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest relative z-10 transition-colors duration-300 hidden sm:block",
                                active ? "text-primary-foreground" : "text-muted-foreground",
                                tab.isAction ? "group-hover:text-primary" : ""
                            )}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
