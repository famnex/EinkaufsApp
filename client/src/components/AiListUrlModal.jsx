import { useState, useEffect } from 'react';
import { X, Sparkles, Check, Loader2, Link as LinkIcon, ShoppingCart, Plus, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { de } from 'date-fns/locale';

export default function AiListUrlModal({ isOpen, onClose, listId, onItemsAdded, initialText = '' }) {
    const [input, setInput] = useState(initialText);
    const [loading, setLoading] = useState(false);
    const [analyzedItems, setAnalyzedItems] = useState(null); // Array of { name, amount, unit, selected }
    const [error, setError] = useState(null);
    const [view, setView] = useState('input'); // input, review, select-list
    const [selectedDate, setSelectedDate] = useState(new Date());

    // For list selection
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen && initialText) {
            setInput(initialText);
            // Auto-analyze if text is provided via share? Maybe better to let user confirm first.
        }
    }, [isOpen, initialText]);

    const handleAnalyze = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setError(null);
        setAnalyzedItems(null);

        try {
            const { data } = await api.post('/ai/extract-list-ingredients', { text: input });
            if (data.items && Array.isArray(data.items)) {
                setAnalyzedItems(data.items.map(item => ({ ...item, selected: true })));
                setView('review');
            } else {
                setError('Keine Zutaten gefunden.');
            }
        } catch (err) {
            console.error(err);
            setError('Fehler bei der Analyse. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = (index) => {
        const newItems = [...analyzedItems];
        newItems[index].selected = !newItems[index].selected;
        setAnalyzedItems(newItems);
    };

    const proceedToadd = async () => {
        if (listId) {
            // Normal mode: Add to existing list
            await executeAdd(listId);
        } else {
            // Share mode: Pick a date -> Find/Create List -> Add
            setView('select-list');
        }
    };

    const handleListSelection = async () => {
        setLoading(true);
        try {
            // 1. Check if list exists for date
            // We need an endpoint or logic here. Let's assume we list all lists for date or create one.
            // Simplified: "Find or create list for Date"
            // We'll use the GET /lists endpoint to find one, or POST /lists to create.

            // Format date as YYYY-MM-DD for consistency with backend if needed, or ISO
            // Actually lists usually key off `date`.

            // Quick check logic:
            const dateStr = selectedDate.toISOString();
            // Fetch lists to see if one exists for this date?
            // Or just blindly create one for now if user confirms?
            // "if I click on a day without list, ask me if I want to create one"

            // Let's TRY to find a list for this date first.
            const { data: lists } = await api.get('/lists'); // This returns ALL lists usually. Might be heavy.
            // Better: Filter locally or rely on user to pick?

            // Optimization: Just create a specialized check or reuse logic.
            // Let's filter client side for now since we don't have a date-query endpoint handy without checking code.
            const existingList = lists.find(l => {
                const lDate = new Date(l.date);
                return lDate.getDate() === selectedDate.getDate() &&
                    lDate.getMonth() === selectedDate.getMonth() &&
                    lDate.getFullYear() === selectedDate.getFullYear();
            });

            let targetListId;

            if (existingList) {
                targetListId = existingList.id;
            } else {
                // Confirm creation? User already clicked "Select this date" basically.
                const { data: newList } = await api.post('/lists', {
                    name: `Einkauf ${selectedDate.toLocaleDateString('de-DE')}`,
                    date: selectedDate
                });
                targetListId = newList.id;
            }

            await executeAdd(targetListId);

            // Navigate to list
            navigate(`/lists/${targetListId}`);
            onClose();

        } catch (err) {
            console.error(err);
            setError('Fehler beim Auswählen der Liste.');
            setLoading(false);
        }
    };

    const executeAdd = async (targetListId) => {
        const itemsToAdd = analyzedItems.filter(i => i.selected);
        if (itemsToAdd.length === 0) return;

        setLoading(true);
        try {
            await api.post(`/lists/${targetListId}/items/bulk`, { items: itemsToAdd });
            if (onItemsAdded) onItemsAdded();
            if (listId) onClose(); // Only close automatically if we were in "Normal Mode". Share mode navigates.
            // Reset
            setInput('');
            setAnalyzedItems(null);
            setView('input');
        } catch (err) {
            console.error(err);
            setError('Fehler beim Hinzufügen der Artikel.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bebas tracking-wide text-foreground">Smart Import</h2>
                                <p className="text-xs text-muted-foreground">
                                    {view === 'select-list' ? 'Liste wählen' : 'URL oder Text einfügen'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={20} className="text-muted-foreground" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {view === 'input' && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Füge hier einen Link zu einem Rezept (Chefkoch, Cookidoo, etc.) oder einfach Text mit Zutaten ein..."
                                        className="w-full h-40 bg-muted/50 border border-border rounded-xl p-4 resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50"
                                    />
                                    <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded-md backdrop-blur-sm border border-border">
                                        Powered by AI
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                <Button
                                    onClick={handleAnalyze}
                                    disabled={!input.trim() || loading}
                                    className="w-full py-6 text-lg font-bebas tracking-wide shadow-lg hover:shadow-primary/20 transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                                    Analysieren
                                </Button>
                            </div>
                        )}

                        {view === 'review' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-foreground text-lg">Gefundene Produkte ({analyzedItems.filter(i => i.selected).length})</h3>
                                </div>

                                <div className="space-y-2 max-h-[40vh] overflow-y-auto p-1 custom-scrollbar">
                                    {analyzedItems.map((item, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleToggleItem(idx)}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
                                                ${item.selected
                                                    ? 'bg-primary/5 border-primary/30 shadow-sm'
                                                    : 'bg-muted/30 border-transparent opacity-60 hover:opacity-80'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                                ${item.selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}
                                            `}>
                                                {item.selected && <Check size={12} strokeWidth={3} />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-foreground">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.amount > 0 ? item.amount : ''} {item.unit}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-border flex gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setAnalyzedItems(null);
                                            setView('input');
                                        }}
                                        className="flex-1 py-4 text-base"
                                    >
                                        Zurück
                                    </Button>
                                    <Button
                                        onClick={proceedToadd}
                                        disabled={loading || analyzedItems.filter(i => i.selected).length === 0}
                                        className="flex-[2] py-4 text-lg font-bebas tracking-wide"
                                    >
                                        {loading ? <Loader2 className="animate-spin mr-2" /> : (listId ? <Plus className="mr-2" /> : <ArrowRight className="mr-2" />)}
                                        {listId ? 'Auswahl hinzufügen' : 'Weiter zur Liste'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {view === 'select-list' && (
                            <div className="space-y-6">
                                <p className="text-center text-muted-foreground">
                                    Wähle ein Datum für deine Einkaufsliste. Wenn keine Liste existiert, wird eine neue erstellt.
                                </p>

                                <div className="flex justify-center">
                                    <DatePicker
                                        selected={selectedDate}
                                        onChange={(date) => setSelectedDate(date)}
                                        inline
                                        locale={de}
                                    />
                                </div>

                                <div className="pt-4 border-t border-border flex gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setView('review')}
                                        className="flex-1 py-4 text-base"
                                    >
                                        Zurück
                                    </Button>
                                    <Button
                                        onClick={handleListSelection}
                                        disabled={loading}
                                        className="flex-[2] py-4 text-lg font-bebas tracking-wide"
                                    >
                                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
                                        Fertigstellen
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
