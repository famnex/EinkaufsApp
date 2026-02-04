import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Plus, Minus } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { UnitCombobox } from './UnitCombobox';
import api from '../lib/axios';

export default function ItemSettingsModal({ isOpen, onClose, item, onSave, onDelete }) {
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('');
    const [note, setNote] = useState('');
    const [availableUnits, setAvailableUnits] = useState([]);
    const [noteSuggestions, setNoteSuggestions] = useState([]);

    useEffect(() => {
        if (item) {
            setQuantity(item.quantity || 1);
            setUnit(item.unit || item.Product?.unit || 'Stück');
            setNote(item.Product?.note || '');
        }
        // Fetch units and note suggestions always when opening
        if (isOpen) {
            api.get('/products/units')
                .then(res => setAvailableUnits(res.data))
                .catch(err => console.error("Failed to load units", err));
            api.get('/products')
                .then(res => {
                    const uniqueNotes = [...new Set(res.data.map(p => p.note).filter(Boolean))].sort();
                    setNoteSuggestions(uniqueNotes);
                })
                .catch(err => console.error("Failed to load note suggestions", err));
        }
    }, [item, isOpen]);

    const handleSave = async () => {
        // Update quantity and unit on the ListItem
        onSave({
            quantity: parseFloat(quantity),
            unit: unit
        });

        // Update note on the Product if it changed
        if (item?.Product && note !== item.Product.note) {
            try {
                await api.put(`/products/${item.ProductId}`, { note });
            } catch (err) {
                console.error("Failed to update product note", err);
            }
        }

        onClose();
    };

    const handleQuantityChange = (val) => {
        const parsed = parseFloat(val);
        setQuantity(isNaN(parsed) ? '' : parsed);
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
                                {/* Quantity Stepper & Input */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Menge & Einheit</label>
                                    <div className="flex items-center gap-2">
                                        {/* Minus Button */}
                                        <button
                                            onClick={() => setQuantity(Math.max(0, (parseFloat(quantity) || 0) - 1))}
                                            className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-background border border-border rounded-xl text-foreground hover:bg-muted transition-colors shadow-sm"
                                        >
                                            <Minus size={20} />
                                        </button>

                                        {/* Amount Input */}
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => handleQuantityChange(e.target.value)}
                                            className="flex-1 min-w-0 h-12 text-center font-bebas text-3xl bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                        />

                                        {/* Plus Button */}
                                        <button
                                            onClick={() => setQuantity((parseFloat(quantity) || 0) + 1)}
                                            className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-primary rounded-xl text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    {/* Unit Combobox */}
                                    <div className="pt-2">
                                        <UnitCombobox
                                            value={unit}
                                            onChange={setUnit}
                                            suggestions={availableUnits}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Hinweis</label>
                                    <Input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="z.B. Nur im Angebot kaufen"
                                        className="bg-muted/50 border-border h-12"
                                        list="note-suggestions-item"
                                    />
                                    <datalist id="note-suggestions-item">
                                        {noteSuggestions.map(n => <option key={n} value={n} />)}
                                    </datalist>
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
