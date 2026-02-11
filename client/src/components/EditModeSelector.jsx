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
            <div className="md:hidden h-10 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {!isOpen ? (
                        <motion.button
                            layoutId="selector-container"
                            key="collapsed"
                            onClick={() => setIsOpen(true)}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className={cn(
                                "flex items-center justify-center p-2 rounded-xl bg-primary text-primary-foreground shadow-md"
                            )}
                        >
                            <motion.div layoutId={`icon-${currentMode.id}`}>
                                <currentMode.icon size={20} />
                            </motion.div>
                        </motion.button>
                    ) : (
                        <motion.div
                            layoutId="selector-container"
                            key="expanded"
                            className="absolute z-50 flex items-center gap-1 bg-background/80 backdrop-blur-xl border border-border p-1 rounded-2xl shadow-2xl"
                            transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                        >
                            {modes.map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => handleSelect(mode.id)}
                                    className={cn(
                                        "p-2 rounded-xl transition-all flex items-center justify-center relative",
                                        editMode === mode.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <motion.div layoutId={editMode === mode.id ? `icon-${mode.id}` : undefined}>
                                        <mode.icon size={20} />
                                    </motion.div>

                                    {/* Label removed for mobile as requested */}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
