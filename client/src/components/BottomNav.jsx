import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, List, Package, CalendarRange, UtensilsCrossed, MoreHorizontal, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { notificationCounts, user } = useAuth();
    const { setIsWelcomeOpen } = useTutorial();

    const tabs = [
        { id: 'dashboard', icon: List, path: '/', label: 'Listen', tutorialId: 'nav-lists', requirement: 'shopping' },
        { id: 'menu', icon: CalendarRange, path: '/menu', label: 'Menüplan', tutorialId: 'nav-planner', requirement: 'planning' },
        { id: 'recipes', icon: UtensilsCrossed, path: '/recipes', label: 'Rezepte', tutorialId: 'nav-recipes', requirement: 'recipes' },
        { id: 'community', icon: BookOpen, path: '/community-cookbooks', label: 'Community', tutorialId: 'nav-community', requirement: 'recipes' },
        { id: 'settings', icon: Settings, path: '/settings', label: 'Optionen', tutorialId: 'bottom-settings-tab' },
    ].filter(tab => {
        if (!tab.requirement) return true;
        // If onboardingPreferences is missing (old user), show everything.
        // Otherwise, only show if the specific feature was selected.
        if (!user?.onboardingPreferences) return true;
        return user.onboardingPreferences[tab.requirement] !== false;
    });

    const isActive = (path) => path && location.pathname === path;
    const activeIndex = tabs.findIndex(tab => isActive(tab.path));

    const gridCols = tabs.length === 5 ? 'grid-cols-5' :
        tabs.length === 4 ? 'grid-cols-4' :
            tabs.length === 3 ? 'grid-cols-3' :
                tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[1000] bg-card/80 backdrop-blur-xl border-t border-border h-20 shadow-xl"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
            id="bottom-nav"
        >
            <div className={cn("max-w-7xl mx-auto h-full grid relative px-2", gridCols)}>
                {/* Active Highlight Marker */}
                {activeIndex !== -1 && (
                    <div className="absolute inset-y-0 left-2 right-2 pointer-events-none">
                        <div className="relative w-full h-full">
                            <motion.div
                                className="absolute top-2 bottom-2 bg-primary rounded-2xl shadow-lg shadow-primary/20"
                                initial={false}
                                animate={{
                                    left: `${(activeIndex * 100) / tabs.length}%`,
                                    width: `${100 / tabs.length}%`
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
