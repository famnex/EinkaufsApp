import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Combine, ArrowRight } from 'lucide-react'; // 'Combine' requires lucide-react update? If undefined, use 'Merge' or 'GitMerge' or 'Layers'. Actually 'Combine' might not exist in older lucide. I'll use 'Merge'.
// Check package.json for lucide-react version. It is ^0.563.0, so 'Combine' should exist. If not, fallback to 'Merge'.
import { Button } from './Button';
import { Input } from './Input';
import api from '../lib/axios';

export default function MergeProductModal({ isOpen, onClose, sourceProduct, targetProduct, onConfirm }) {
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (targetProduct) {
            setNewName(targetProduct.name);
        }
    }, [targetProduct]);

    const handleMerge = async () => {
        if (!sourceProduct || !targetProduct) return;
        setLoading(true);
        try {
            await api.post('/products/merge', {
                sourceId: sourceProduct.id,
                targetId: targetProduct.id,
                newName: newName
            });
            onConfirm();
            onClose();
        } catch (err) {
            console.error('Merge failed', err);
            alert('Fehler beim Zusammenführen: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && sourceProduct && targetProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                Produkte zusammenführen
                            </h3>
                            <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-center gap-4 text-center">
                                <div className="p-4 bg-muted/50 rounded-xl border border-destructive/20 min-w-[120px]">
                                    <div className="text-destructive font-bold text-lg mb-1">{sourceProduct.name}</div>
                                    <div className="text-xs text-muted-foreground uppercase">Wird gelöscht</div>
                                </div>

                                <ArrowRight className="text-muted-foreground animate-pulse" />

                                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 min-w-[120px]">
                                    <div className="text-primary font-bold text-lg mb-1">{targetProduct.name}</div>
                                    <div className="text-xs text-muted-foreground uppercase">Bleibt erhalten</div>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground text-center">
                                Alle Rezepte und Listen-Einträge von <strong>{sourceProduct.name}</strong> werden auf das Ziel-Produkt übertragen.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Neuer Name für das Zielprodukt</label>
                                <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-muted/50 border-t border-border flex justify-end gap-3">
                            <Button variant="ghost" onClick={onClose} disabled={loading}>
                                Abbrechen
                            </Button>
                            <Button onClick={handleMerge} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                {loading ? 'Wird verarbeitet...' : 'Zusammenführen & Migrieren'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
