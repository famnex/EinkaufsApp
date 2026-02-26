import { useState, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, Save } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';

export default function QuantityModal({ isOpen, onClose, productName, defaultUnit = 'Stück', productNote = '', variations = [], onConfirm, intoleranceMessages = [] }) {
    const [quantity, setQuantity] = useState('1');
    const [unit, setUnit] = useState(defaultUnit);
    const [note, setNote] = useState('');
    const [selectedVariationId, setSelectedVariationId] = useState('');
    const [noteSuggestions, setNoteSuggestions] = useState([]);

    useLockBodyScroll(isOpen);

    useEffect(() => {
        if (isOpen) {
            setQuantity('1');
            setUnit(defaultUnit || 'Stück');
            setNote('');
            setSelectedVariationId(variations.length > 0 ? variations[0].id : '');
            fetchNoteSuggestions();
        }
    }, [isOpen, defaultUnit, productNote, variations]);

    useEffect(() => {
        if (selectedVariationId) {
            const v = variations.find(v => v.id == selectedVariationId);
            if (v && v.unit) setUnit(v.unit);
        }
    }, [selectedVariationId, variations]);

    const fetchNoteSuggestions = async () => {
        try {
            const res = await api.get('/lists/item-notes');
            setNoteSuggestions(res.data);
        } catch (err) {
            console.error('Failed to fetch note suggestions:', err);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (variations.length > 0 && !selectedVariationId) {
            alert('Bitte wähle eine Variante aus.');
            return;
        }
        onConfirm(quantity, unit, note, selectedVariationId);
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
                            {intoleranceMessages.length > 0 && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 animate-pulse-subtle">
                                    <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-2">
                                        <AlertTriangle size={18} />
                                        <span>Achtung! Unverträglichkeit</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {intoleranceMessages.map((msg, idx) => (
                                            <li key={idx} className="text-xs text-destructive/90 font-medium flex items-start gap-2">
                                                <span className="shrink-0">🛑</span>
                                                <span>{msg.replace('🛑 Unverträglichkeit: ', '')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {variations.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Variante auswählen</label>
                                    <select
                                        className="w-full bg-muted/50 border border-border rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                                        value={selectedVariationId}
                                        onChange={(e) => setSelectedVariationId(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Bitte wählen...</option>
                                        {variations.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.ProductVariant?.title} ({v.category})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

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

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Hinweis (optional)</label>
                                <Input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="z.B. Kühl lagern"
                                    className="bg-muted/50 border-border h-12"
                                    list="note-suggestions-quantity"
                                />
                                <datalist id="note-suggestions-quantity">
                                    {noteSuggestions.map(n => <option key={n} value={n} />)}
                                </datalist>
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
