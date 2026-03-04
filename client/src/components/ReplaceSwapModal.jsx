import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, MoveRight } from 'lucide-react';
import { Button } from './Button';

export default function ReplaceSwapModal({ isOpen, onAction }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <ArrowRightLeft size={24} />
                            </div>
                            <h2 className="text-xl font-bold font-bebas tracking-wide">Platz ist belegt</h2>
                        </div>
                        <button
                            onClick={() => onAction('cancel')}
                            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-sm text-foreground font-medium">
                            An diesem Platz befindet sich bereits eine Mahlzeit. Was möchtest du tun?
                        </p>

                        <div className="grid gap-3">
                            <Button
                                onClick={() => onAction('swap')}
                                className="w-full justify-start gap-3 h-auto py-3 px-4 rounded-xl"
                                variant="outline"
                            >
                                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                                    <ArrowRightLeft size={18} />
                                </div>
                                <div className="text-left py-1">
                                    <div className="font-bold text-sm">Tauschen</div>
                                    <div className="text-xs text-muted-foreground font-normal">
                                        Die beiden Mahlzeiten wechseln einfach ihre Plätze.
                                    </div>
                                </div>
                            </Button>

                            <Button
                                onClick={() => onAction('replace')}
                                className="w-full justify-start gap-3 h-auto py-3 px-4 rounded-xl border-destructive/20 hover:bg-destructive/5 hover:border-destructive text-destructive"
                                variant="outline"
                            >
                                <div className="p-2 bg-destructive/10 rounded-lg text-destructive shrink-0">
                                    <MoveRight size={18} />
                                </div>
                                <div className="text-left py-1">
                                    <div className="font-bold text-sm">Ersetzen</div>
                                    <div className="text-xs text-destructive/70 font-normal">
                                        Die bestehende Mahlzeit wird gelöscht.
                                    </div>
                                </div>
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
