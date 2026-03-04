import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, BookOpen, ChefHat, ShoppingCart, Users, Settings, Sparkles } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { useTutorial } from '../contexts/TutorialContext';

const chapters = [
    { id: 'allgemeines', title: 'Allgemeines', icon: Sparkles, color: 'text-blue-500' },
    { id: 'listen', title: 'Einkaufslisten', icon: ShoppingCart, color: 'text-green-500' },
    { id: 'menueplan', title: 'Menüplan', icon: ChefHat, color: 'text-orange-500' },
    { id: 'rezepte', title: 'Rezepte', icon: Play, color: 'text-rose-500' },
    { id: 'community', title: 'Community', icon: Users, color: 'text-purple-500' },
    { id: 'unvertraeglichkeiten', title: 'Unverträglichkeiten', icon: BookOpen, color: 'text-amber-500' },
    { id: 'optionen', title: 'Optionen', icon: Settings, color: 'text-slate-500' },
];

export default function TutorialWelcomeModal({ isOpen, onClose, onStartChapter, showOnStart, onToggleShowOnStart }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-[10px]"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black mb-2">Willkommen bei GabelGuru!</h2>
                                <p className="text-muted-foreground">Lerne in wenigen Schritten, wie du deine Einkäufe und Mahlzeiten perfekt planst.</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-8">
                            {chapters.map((ch) => (
                                <button
                                    key={ch.id}
                                    onClick={() => onStartChapter(ch.id)}
                                    className="flex flex-row items-center gap-2 sm:gap-4 p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/30 hover:bg-primary/10 border border-border group transition-all text-left"
                                >
                                    <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl bg-white dark:bg-black/20 shadow-sm ${ch.color} shrink-0`}>
                                        <ch.icon size={16} className="sm:w-5 sm:h-5" />
                                    </div>
                                    <span className="font-bold text-[11px] sm:text-base group-hover:text-primary transition-colors line-clamp-1 sm:line-clamp-none leading-tight">{ch.title}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-border">
                            <label className="flex items-center gap-3 cursor-pointer select-none group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={showOnStart}
                                        onChange={(e) => onToggleShowOnStart(e.target.checked)}
                                    />
                                    <div className={`w-12 h-6 rounded-full transition-colors ${showOnStart ? 'bg-primary' : 'bg-muted'}`} />
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${showOnStart ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">Beim Starten Tutorial anzeigen</span>
                            </label>

                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                                    Später
                                </Button>
                                <Button onClick={() => onStartChapter('allgemeines')} className="flex-1 sm:flex-none gap-2">
                                    <Play size={18} />
                                    Alles zeigen
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
