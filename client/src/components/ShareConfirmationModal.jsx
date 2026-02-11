import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Globe } from 'lucide-react';
import { Button } from './Button';

export default function ShareConfirmationModal({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border"
                >
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <Lock size={32} />
                        </div>

                        <h2 className="text-xl font-bold text-foreground mb-2">
                            Kochbuch ist privat
                        </h2>

                        <p className="text-muted-foreground mb-6">
                            Um diesen Link zu teilen, musst du dein <strong>öffentliches Kochbuch aktivieren</strong>.
                            <br /><br />
                            Damit werden <u>alle</u> deine Rezepte über deinen persönlichen Link für andere sichtbar.
                        </p>

                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button
                                onClick={onConfirm}
                                className="flex-1 gap-2"
                            >
                                <Globe size={18} />
                                Aktivieren & Teilen
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
