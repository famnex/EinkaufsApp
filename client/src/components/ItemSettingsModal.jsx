import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Plus, Minus, Euro } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';

export default function ItemSettingsModal({ isOpen, onClose, item, onSave, onDelete }) {
    const [quantity, setQuantity] = useState(1);
    const [priceActual, setPriceActual] = useState('');

    useEffect(() => {
        if (item) {
            setQuantity(item.quantity || 1);
            setPriceActual(item.price_actual || '');
        }
    }, [item]);

    const handleSave = () => {
        onSave({
            quantity: parseInt(quantity),
            price_actual: priceActual === '' ? null : parseFloat(priceActual)
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-full max-w-sm relative z-10"
                    >
                        <Card className="p-6 border-border shadow-2xl bg-card transition-colors duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground truncate pr-4">
                                    {item?.Product?.name || 'Artikel anpassen'}
                                </h2>
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Quantity Stepper */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Menge</label>
                                    <div className="flex items-center gap-4 bg-muted rounded-2xl p-2 border border-border">
                                        <button
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="w-12 h-12 flex items-center justify-center bg-background border border-border rounded-xl text-foreground hover:bg-muted transition-colors shadow-sm"
                                        >
                                            <Minus size={20} />
                                        </button>
                                        <div className="flex-1 text-center font-bebas text-3xl text-foreground">
                                            {quantity}
                                        </div>
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="w-12 h-12 flex items-center justify-center bg-primary rounded-xl text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Price Override */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Tatsächlicher Preis (€)</label>
                                    <div className="relative">
                                        <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={18} />
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={priceActual}
                                            onChange={(e) => setPriceActual(e.target.value)}
                                            placeholder={item?.Product?.price_hint || "0,00"}
                                            className="pl-10 h-12 bg-muted/50 border-border"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground ml-1 italic">Format: 1,99 (Optional)</p>
                                </div>

                                <div className="pt-2 space-y-3">
                                    <Button
                                        onClick={handleSave}
                                        className="w-full h-12 gap-2"
                                    >
                                        <Save size={18} />
                                        Übernehmen
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (confirm('Artikel aus Liste entfernen?')) {
                                                onDelete(item.id);
                                                onClose();
                                            }
                                        }}
                                        className="w-full h-12 gap-2 border-destructive/20 text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 size={18} />
                                        Entfernen
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
