import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, LogOut, UserMinus } from 'lucide-react';
import { Button } from './Button';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export default function HouseholdConfirmModal({ isOpen, onClose, onConfirm, type, memberName }) {
    useLockBodyScroll(isOpen);

    if (!isOpen) return null;

    const isLeave = type === 'leave';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-card border border-destructive/30 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 bg-destructive/10 border-b border-destructive/20 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center text-destructive mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                <AlertTriangle size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">
                                    {isLeave ? 'Haushalt verlassen?' : 'Mitglied entfernen?'}
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {isLeave
                                        ? 'Möchtest du den gemeinsamen Haushalt wirklich verlassen?'
                                        : `Möchtest du Mitglied ${memberName} wirklich aus dem Haushalt entfernen?`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                                    <AlertTriangle size={16} />
                                    <span>WICHTIGER HINWEIS</span>
                                </div>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                    Das Konto {isLeave ? 'wird danach leer sein' : `von ${memberName} wird danach leer sein`}, da alle Rezepte und Listen beim Haushalts-Besitzer verbleiben.
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed italic text-center">
                                    Dies kann nicht rückgängig gemacht werden.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-muted/30 border-t border-border flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 font-bold"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={onConfirm}
                                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20 font-bold gap-2"
                            >
                                {isLeave ? <LogOut size={18} /> : <UserMinus size={18} />}
                                {isLeave ? 'Jetzt verlassen' : 'Jetzt entfernen'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
