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

    return (
        <div className="relative flex justify-center items-center" ref={containerRef}>
            {/* Desktop View: Static Row */}
            <div className="hidden md:flex items-center gap-1 bg-muted p-1 rounded-2xl">
                {modes.map((mode) => (
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
                        {editMode === mode.id && <span className="text-xs font-bold">{mode.label}</span>}
                    </button>
                ))}
            </div>

            {/* Mobile View: Dynamic Expansion */}
            <div className="md:hidden h-10 w-10 relative z-50">
                <motion.div
                    layout
                    transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
                    className={cn(
                        "absolute right-0 top-0 flex items-center p-1 rounded-2xl h-10 transition-all overflow-hidden",
                        isOpen ? "bg-background/95 backdrop-blur-2xl border border-border shadow-2xl" : "bg-primary shadow-lg ring-1 ring-white/20"
                    )}
                    style={{
                        width: isOpen ? 'auto' : '40px',
                        justifyContent: 'center'
                    }}
                >
                    <div className="flex items-center gap-0.5 relative pointer-events-auto">
                        <AnimatePresence mode="popLayout" initial={false}>
                            {modes.map((mode) => {
                                const isSelected = editMode === mode.id;
                                const isVisible = isOpen || isSelected;

                                if (!isVisible) return null;

                                return (
                                    <motion.button
                                        layout
                                        key={mode.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                            type: "tween",
                                            ease: "easeInOut",
                                            duration: 0.15,
                                            layout: { duration: 0.2 }
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isOpen) {
                                                setIsOpen(true);
                                            } else {
                                                handleSelect(mode.id);
                                            }
                                        }}
                                        className={cn(
                                            "relative p-2 rounded-xl flex items-center justify-center flex-shrink-0 min-w-[40px] h-8 transition-colors duration-200",
                                            isSelected ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted/30"
                                        )}
                                    >
                                        {/* Sliding Highlight Background - Active mode always has this */}
                                        {isSelected && (
                                            <motion.div
                                                layoutId="modeHighlight"
                                                className="absolute inset-0 bg-primary rounded-xl"
                                                transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
                                            />
                                        )}
                                        <mode.icon size={18} className="relative z-10" />
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
