import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Play, LogOut } from 'lucide-react';
import { Button } from './Button';

export default function CookingExitModal({
    isOpen,
    onClose,
    onConfirm,
    hasPaidAi = false,
    isSilbergabel = false
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
                    >
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                    <AlertTriangle size={20} />
                                </div>
                                <h3 className="font-bold">Kochmodus beenden?</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-4">
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Möchtest du den Kochmodus wirklich beenden? Dein aktueller Fortschritt und aktive Timer gehen verloren.
                                </p>

                                {isSilbergabel && hasPaidAi && (
                                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-left">
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                                            Hinweis: Da du den KI-Assistenten bereits aktiviert hast, fallen bei einem Neustart des Kochmodus erneut Kosten (10 Coins) an.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <Button
                                    onClick={onConfirm}
                                    variant="secondary"
                                    className="w-full h-14 gap-2 shadow-lg shadow-secondary/20 rounded-2xl"
                                >
                                    <LogOut size={18} />
                                    Modus beenden
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    className="w-full h-12 rounded-2xl"
                                >
                                    Weiterkochen
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
