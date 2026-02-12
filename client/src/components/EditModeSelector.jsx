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
                    onClick={() => !isOpen && setIsOpen(true)}
                    className={cn(
                        "absolute right-0 top-0 flex items-center gap-1 p-1 rounded-2xl transition-colors",
                        isOpen ? "bg-background/80 backdrop-blur-xl border border-border shadow-2xl" : "bg-primary shadow-md"
                    )}
                    initial={false}
                    animate={{ width: isOpen ? 'auto' : '40px' }}
                    transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                >
                    <AnimatePresence initial={false} mode="popLayout">
                        {modes.map((mode) => {
                            const isSelected = editMode === mode.id;
                            const shouldShow = isOpen || isSelected;

                            if (!shouldShow) return null;

                            return (
                                <motion.button
                                    layout
                                    key={mode.id}
                                    initial={{ width: 0, opacity: 0, scale: 0.8 }}
                                    animate={{ width: 'auto', opacity: 1, scale: 1 }}
                                    exit={{ width: 0, opacity: 0, scale: 0.8 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                                    onClick={(e) => {
                                        if (isOpen) {
                                            e.stopPropagation();
                                            handleSelect(mode.id);
                                        }
                                    }}
                                    className={cn(
                                        "p-2 rounded-xl flex items-center justify-center flex-shrink-0",
                                        isOpen && isSelected ? "bg-primary text-primary-foreground shadow-sm" : "",
                                        isOpen && !isSelected ? "text-muted-foreground hover:bg-muted" : "",
                                        !isOpen ? "text-primary-foreground" : ""
                                    )}
                                >
                                    <mode.icon size={20} />
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
