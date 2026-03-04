import { useState, useEffect } from 'react';
import { X, Sparkles, Check, Loader2, Link as LinkIcon, ShoppingCart, Plus, AlertCircle, Calendar, ArrowRight, Upload, Info } from 'lucide-react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { de } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import AiActionConfirmModal from './AiActionConfirmModal';
import SubscriptionModal from './SubscriptionModal';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { useTutorial } from '../contexts/TutorialContext';

export default function AiListUrlModal({ isOpen, onClose, listId, onItemsAdded, initialText = '' }) {
    const [input, setInput] = useState(initialText);
    const [loading, setLoading] = useState(false);
    const [analyzedItems, setAnalyzedItems] = useState(null); // Array of { name, amount, unit, selected }
    const [error, setError] = useState(null);
    const [view, setView] = useState('input'); // input, review, select-list
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [inputImage, setInputImage] = useState(null);
    const [inputImagePreview, setInputImagePreview] = useState(null);

    // AI Confirmation State
    const [aiConfirmModalOpen, setAiConfirmModalOpen] = useState(false);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

    // Context
    const { user, refreshUser } = useAuth();
    const { notifyAction } = useTutorial();

    useLockBodyScroll(isOpen);

    // For list selection
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            setInput(initialText || '');
            setAnalyzedItems(null);
            setError(null);
            setView('input');
            setInputImage(null);
            setInputImagePreview(null);
        }
    }, [isOpen, initialText]);

    const handleAnalyze = async () => {
        if (!input.trim() && !inputImage) return;

        // Smart Import ist immer kostenlos und für alle Tiers verfügbar
        // Aber für Vision (Bild) könnten wir Coins verlangen wenn wir wollen.
        // Der User wünscht sich das Feature, wir halten es erstmal einfach.
        executeAnalyze();
    };

    const executeAnalyze = async () => {
        setLoading(true);
        setError(null);
        setAnalyzedItems(null);

        try {
            const formData = new FormData();
            if (input.trim()) formData.append('text', input);
            if (inputImage) formData.append('image', inputImage);

            const { data } = await api.post('/ai/extract-list-ingredients', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.items && Array.isArray(data.items)) {
                setAnalyzedItems(data.items.map(item => ({ ...item, selected: true })));
                setView('review');

                // Tutorial check
                const hasBananen = data.items.some(item =>
                    item.name.toLowerCase().includes('banane')
                );
                if (hasBananen) {
                    notifyAction('smart-import-bananen');
                }

                // Refresh user credits
                refreshUser();
            } else {
                setError('Keine Zutaten gefunden.');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Fehler bei der Analyse. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setInputImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setInputImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
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
            notifyAction('smart-import-added');
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
                    className="bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[80vh]"
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
                    <div className="p-6 overflow-y-auto custom-scrollbar overscroll-contain">
                        {view === 'input' && (
                            <div id="smart-import-input-view" className="space-y-4">
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                                        Füge einen <strong>Rezept-Link</strong> ein, kopiere <strong>Zutaten-Text</strong> oder lade ein <strong>Foto</strong> deiner handgeschriebenen Liste hoch. Die KI erkennt Produkte automatisch.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Füge hier einen Link zu einem Rezept oder Text mit Zutaten ein..."
                                            className="w-full h-40 md:h-64 bg-muted/50 border border-border rounded-xl p-4 resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50 text-sm md:text-base"
                                        />
                                        <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded-md backdrop-blur-sm border border-border">
                                            Text / URL
                                        </div>
                                    </div>

                                    <div className="relative h-40 md:h-64 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/50 group">
                                        {inputImagePreview ? (
                                            <>
                                                <img src={inputImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                                <button
                                                    onClick={() => { setInputImage(null); setInputImagePreview(null); }}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 p-4 text-center">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <Upload size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs">Foto hochladen</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Extrahiere aus einem Foto deiner Liste</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={handleImageUpload}
                                                />
                                            </div>
                                        )}
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
                                    disabled={(!input.trim() && !inputImage) || loading}
                                    className="w-full py-6 text-lg font-bebas tracking-wide shadow-lg hover:shadow-primary/20 transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                                    {inputImage ? 'Foto Analysieren' : 'Analysieren'}
                                </Button>
                            </div>
                        )}

                        {view === 'review' && (
                            <div id="smart-import-review-view" className="space-y-4">
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
            <AiActionConfirmModal
                isOpen={aiConfirmModalOpen}
                onClose={() => setAiConfirmModalOpen(false)}
                onConfirm={() => {
                    setAiConfirmModalOpen(false);
                    executeAnalyze();
                }}
                actionTitle="Rezept/Link analysieren"
                actionDescription="KI-Analyse des Textes zur Extraktion von Zutaten."
                cost={5}
            />

            <SubscriptionModal
                isOpen={isSubscriptionModalOpen}
                onClose={() => setIsSubscriptionModalOpen(false)}
                currentTier={user?.tier}
            />
        </AnimatePresence>
    );
}
