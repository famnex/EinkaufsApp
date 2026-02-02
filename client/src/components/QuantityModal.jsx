import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Save } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';

export default function QuantityModal({ isOpen, onClose, productName, defaultUnit = 'Stück', onConfirm }) {
    const [quantity, setQuantity] = useState('1');
    const [unit, setUnit] = useState(defaultUnit);

    useEffect(() => {
        if (isOpen) {
            setQuantity('1');
            setUnit(defaultUnit || 'Stück');
        }
    }, [isOpen, defaultUnit]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(quantity, unit);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm relative z-10"
                >
                    <Card className="p-6 border-border shadow-2xl bg-card">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground truncate pr-4">
                                {productName || 'Produkt hinzufügen'}
                            </h2>
                            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Menge</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="text-center font-bold text-lg"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Einheit</label>
                                    <Input
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        placeholder="Einheit"
                                        className="text-center"
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-12 gap-2 mt-4">
                                <Check size={20} />
                                Hinzufügen
                            </Button>
                        </form>
                    </Card>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
