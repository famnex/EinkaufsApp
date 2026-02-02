import { motion } from 'framer-motion';
import { Calendar, List } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ViewSwitcher({ activeView, onViewChange }) {
    return (
        <div className="flex bg-muted p-1 rounded-2xl border border-border w-full max-w-[280px] mx-auto mb-6 shadow-sm transition-colors duration-300">
            <button
                onClick={() => onViewChange('calendar')}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all relative",
                    activeView === 'calendar' ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                {activeView === 'calendar' && (
                    <motion.div
                        layoutId="active-view"
                        className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                )}
                <Calendar size={18} className="relative z-10" />
                <span className="relative z-10">Kalender</span>
            </button>
            <button
                onClick={() => onViewChange('sessions')}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all relative",
                    activeView === 'sessions' ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                {activeView === 'sessions' && (
                    <motion.div
                        layoutId="active-view"
                        className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                )}
                <List size={18} className="relative z-10" />
                <span className="relative z-10">Liste</span>
            </button>
        </div>
    );
}
