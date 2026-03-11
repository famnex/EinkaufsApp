import { useState, useEffect, useRef } from 'react';
import { Edit3, Eye, Lock, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTutorial } from '../contexts/TutorialContext';

export default function EditModeSelector({ editMode, setEditMode, hiddenModes = [] }) {
    const { notifyAction } = useTutorial();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const allModes = [
        { id: 'view', icon: Eye, label: 'Vorschau' },
        { id: 'lock', icon: Lock, label: 'Gesperrt' },
        { id: 'create', icon: Plus, label: 'Erstellen' },
        { id: 'edit', icon: Edit3, label: 'Bearbeiten' },
        { id: 'delete', icon: Trash2, label: 'Löschen' }
    ];
    const modes = allModes.filter(m => !hiddenModes.includes(m.id));

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

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                notifyAction('selector-open');
            }, 450); // Matches CSS transition duration + generous buffer
            return () => clearTimeout(timer);
        }
    }, [isOpen, notifyAction]);

    // Wake Lock Implementation
    useEffect(() => {
        let wakeLock = null;

        const requestWakeLock = async () => {
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock is active');
                } catch (err) {
                    console.error(`${err.name}, ${err.message}`);
                }
            }
        };

        if (editMode === 'lock') {
            requestWakeLock();
        }

        const handleVisibilityChange = async () => {
            if (wakeLock !== null && document.visibilityState === 'visible' && editMode === 'lock') {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) {
                wakeLock.release().then(() => {
                    wakeLock = null;
                    console.log('Wake Lock released');
                });
            }
        };
    }, [editMode]);

    const handleSelect = (modeId) => {
        setEditMode(modeId);
        setIsOpen(false);
        if (modeId === 'create') {
            notifyAction('erstellen_ausgeloest');
        }
    };

    const activeIndex = modes.findIndex(m => m.id === editMode);

    return (
        <div id="edit-mode-selector" className="relative flex justify-center items-center" ref={containerRef}>
            {/* Desktop View: Static Row */}
            <div
                className="hidden md:grid gap-1 bg-muted p-1 rounded-2xl relative"
                style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))`, minWidth: `${modes.length * 80}px` }}
            >
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
                        onClick={() => {
                            setEditMode(mode.id);
                            if (mode.id === 'create') notifyAction('erstellen_ausgeloest');
                        }}
                        id={`edit-mode-btn-${mode.id}-desktop`}
                        className={cn(
                            "relative z-10 p-2 rounded-xl transition-colors flex items-center justify-center gap-2",
                            `edit-mode-btn-${mode.id}`,
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
                                    id={`edit-mode-btn-${mode.id}-mobile`}
                                    className={cn(
                                        "relative p-2 rounded-xl flex items-center justify-center flex-shrink-0 min-w-[32px] h-8 transition-colors duration-200",
                                        `edit-mode-btn-${mode.id}`,
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
