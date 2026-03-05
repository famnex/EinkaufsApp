import { useState, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, HelpCircle, X, Check, Save, Minus, Plus, Flag } from 'lucide-react';
import ReportIssueModal from './ReportIssueModal';
import { useTutorial } from '../contexts/TutorialContext';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function QuantityModal({ isOpen, onClose, productId, productName, defaultUnit = 'Stück', productNote = '', variations = [], onConfirm, intoleranceData = { messages: [], maxProbability: 0 } }) {
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportContext, setReportContext] = useState(null);
    const { notifyAction } = useTutorial();
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
        notifyAction('quantity-add');
        onConfirm(quantity, unit, note, selectedVariationId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
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
                                <div className="flex items-center gap-2">
                                    {productId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReportContext({
                                                    productId: productId,
                                                    productName: productName,
                                                    additionalContext: 'QuantityModal'
                                                });
                                                setIsReportModalOpen(true);
                                            }}
                                            className="text-muted-foreground hover:text-orange-500 transition-colors p-1"
                                            title="Fehler melden"
                                        >
                                            <Flag size={20} />
                                        </button>
                                    )}
                                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {intoleranceData.maxProbability > 30 && (
                                    <div className={cn(
                                        "border rounded-2xl p-4 animate-pulse-subtle",
                                        intoleranceData.maxProbability >= 80 ? "bg-destructive/10 border-destructive/20" : "bg-orange-500/10 border-orange-500/20"
                                    )}>
                                        <div className={cn(
                                            "flex items-center gap-2 font-bold text-sm mb-2",
                                            intoleranceData.maxProbability >= 80 ? "text-destructive" : "text-orange-500"
                                        )}>
                                            {intoleranceData.maxProbability >= 80 ? <AlertCircle size={18} /> : <HelpCircle size={18} />}
                                            <span>{intoleranceData.maxProbability >= 80 ? 'Achtung! Unverträglichkeit' : 'Hinweis: Eventuelle Unverträglichkeit'} ({intoleranceData.maxProbability}%)</span>
                                        </div>
                                        <ul className="space-y-1">
                                            {intoleranceData.messages.map((msg, idx) => (
                                                <li key={idx} className={cn(
                                                    "text-xs font-medium flex items-start gap-2",
                                                    intoleranceData.maxProbability >= 80 ? "text-destructive/90" : "text-orange-500/90"
                                                )}>
                                                    <span className="shrink-0">{intoleranceData.maxProbability >= 80 ? '🛑' : '⚠️'}</span>
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

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Menge</label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            id="quantity-decrease-btn"
                                            onClick={() => {
                                                const newQty = Math.max(0, Number(quantity) - 1);
                                                setQuantity(newQty.toString());
                                                notifyAction('quantity-changed');
                                            }}
                                            className="h-12 w-12 rounded-xl shrink-0"
                                        >
                                            <Minus size={18} />
                                        </Button>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={quantity}
                                            onChange={(e) => {
                                                setQuantity(e.target.value);
                                                notifyAction('quantity-changed');
                                            }}
                                            className="text-center font-bold text-lg h-12 min-w-0 flex-1"
                                            autoFocus
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            id="quantity-increase-btn"
                                            onClick={() => {
                                                const newQty = Number(quantity) + 1;
                                                setQuantity(newQty.toString());
                                                notifyAction('quantity-increase');
                                            }}
                                            className="h-12 w-12 rounded-xl shrink-0"
                                        >
                                            <Plus size={18} />
                                        </Button>
                                        <Input
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            placeholder="Einheit"
                                            className="text-center w-24 shrink-0 h-12"
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

                                <Button type="submit" id="quantity-add-btn" className="w-full h-12 gap-2 mt-4">
                                    <Check size={20} />
                                    Hinzufügen
                                </Button>
                            </form>
                        </Card>
                    </motion.div>
                </div>
            </AnimatePresence>

            <ReportIssueModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                productContext={reportContext}
            />
        </>
    );
}
