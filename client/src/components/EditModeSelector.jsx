import { useState, useEffect, useRef } from 'react';
import { Edit3, Eye, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function EditModeSelector({ editMode, setEditMode }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const modes = [
        { id: 'view', icon: Eye, label: 'Vorschau' },
        { id: 'create', icon: Plus, label: 'Erstellen' },
        { id: 'edit', icon: Edit3, label: 'Bearbeiten' },
        { id: 'delete', icon: Trash2, label: 'Löschen' }
    ];

    const currentMode = modes.find(m => m.id === editMode) || modes[0];

    // Close on scroll
    useEffect(() => {
        const handleScroll = () => {
            if (isOpen) setIsOpen(false);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (modeId) => {
        setEditMode(modeId);
        setIsOpen(false);
    };

    const activeIndex = modes.findIndex(m => m.id === editMode);

    return (
        <div className="relative flex justify-center items-center" ref={containerRef}>
            {/* Desktop View: Static Row */}
            <div className="hidden md:grid grid-cols-4 gap-1 bg-muted p-1 rounded-2xl relative min-w-[320px]">
                {/* Desktop Highlight */}
                <motion.div
                    className="absolute bg-primary rounded-xl shadow-md h-9"
                    initial={false}
                    animate={{
                        left: `${(activeIndex * 100) / modes.length}%`,
                        width: `${100 / modes.length}%`
                    }}
                    transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
                    style={{ top: '4px', height: 'calc(100% - 8px)' }}
                />
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => setEditMode(mode.id)}
                        className={cn(
                            "relative z-10 p-2 rounded-xl transition-colors flex items-center justify-center gap-2",
                            editMode === mode.id ? "text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        <mode.icon size={18} className="flex-shrink-0" />
                        <AnimatePresence mode="wait">
                            {editMode === mode.id && (
                                <motion.span
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -5 }}
                                    className="text-xs whitespace-nowrap"
                                >
                                    {mode.label}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                ))}
            </div>

            {/* Mobile View: Dynamic Expansion */}
            <div className="md:hidden h-10 w-10 relative z-50">
                <div
                    className={cn(
                        "absolute right-0 top-0 flex items-center p-1 rounded-2xl h-10 overflow-hidden transition-all duration-300",
                        isOpen ? "bg-background/95 backdrop-blur-2xl border border-border shadow-2xl w-max" : "bg-primary shadow-lg ring-1 ring-white/20 w-10"
                    )}
                >
                    <div className="flex items-center gap-1 relative">
                        {modes.map((mode) => {
                            const isSelected = editMode === mode.id;
                            const isVisible = isOpen || isSelected;

                            if (!isVisible) return null;

                            return (
                                <button
                                    key={mode.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isOpen) {
                                            setIsOpen(true);
                                        } else {
                                            handleSelect(mode.id);
                                        }
                                    }}
                                    className={cn(
                                        "relative p-2 rounded-xl flex items-center justify-center flex-shrink-0 min-w-[32px] h-8 transition-colors duration-200",
                                        isSelected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/30"
                                    )}
                                >
                                    <mode.icon size={18} className="relative z-10" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
