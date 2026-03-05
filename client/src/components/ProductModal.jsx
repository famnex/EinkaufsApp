import { useState, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Package, Plus, Trash2, ShieldAlert, Sparkles, Loader2, Flag } from 'lucide-react';
import ReportIssueModal from './ReportIssueModal';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function ProductModal({ isOpen, onClose, product, onSave }) {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price_hint: '',
        unit: 'Stück'
    });
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    const [synonymInput, setSynonymInput] = useState('');
    const [availableVariants, setAvailableVariants] = useState([]);
    const [variations, setVariations] = useState([]);
    const [allIntolerances, setAllIntolerances] = useState([]);
    const [selectedIntoleranceIds, setSelectedIntoleranceIds] = useState([]);
    const [aiIntoleranceProbabilities, setAiIntoleranceProbabilities] = useState({});
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportContext, setReportContext] = useState(null);
    const { user } = useAuth();
    const isReadOnly = product && product.UserId === null && user?.role !== 'admin';

    useLockBodyScroll(isOpen);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                category: product.category || '',
                price_hint: product.price_hint || '',
                unit: product.unit || 'Stück',
                synonyms: (typeof product.synonyms === 'string' ? JSON.parse(product.synonyms || '[]') : product.synonyms) || []
            });
            setVariations(product.ProductVariations || []);
            setSelectedIntoleranceIds((product.Intolerances || []).map(i => i.id));
            const probs = {};
            (product.Intolerances || []).forEach(i => {
                if (i.ProductIntolerance && i.ProductIntolerance.probability !== undefined) {
                    probs[i.id] = i.ProductIntolerance.probability;
                }
            });
            setAiIntoleranceProbabilities(probs);
        } else {
            setFormData({ name: '', category: '', price_hint: '', unit: 'Stück', synonyms: [] });
            setVariations([]);
            setSelectedIntoleranceIds([]);
            setAiIntoleranceProbabilities({});
        }

        if (isOpen) {
            fetchMetadata();
            fetchAvailableVariants();
            fetchIntolerances();
        }
    }, [product, isOpen]);

    const fetchMetadata = async () => {
        try {
            const { data } = await api.get('/products');
            const uniqueCats = [...new Set(data.map(p => p.category).filter(Boolean))].sort();
            setCategories(uniqueCats);
        } catch (err) {
            console.error('Failed to fetch metadata', err);
        }
    };

    const fetchAvailableVariants = async () => {
        try {
            const { data } = await api.get('/variants');
            setAvailableVariants(data);
        } catch (err) {
            console.error('Failed to fetch variants', err);
        }
    };

    const fetchIntolerances = async () => {
        try {
            const { data } = await api.get('/intolerances');
            setAllIntolerances(data);
        } catch (err) {
            console.error('Failed to fetch intolerances', err);
        }
    };

    const handleAddSynonym = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = synonymInput.trim();
            if (val && !formData.synonyms.includes(val)) {
                setFormData(prev => ({
                    ...prev,
                    synonyms: [...(prev.synonyms || []), val]
                }));
                setSynonymInput('');
            }
        }
    };

    const removeSynonym = (synToRemove) => {
        setFormData(prev => ({
            ...prev,
            synonyms: prev.synonyms.filter(s => s !== synToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                price_hint: formData.price_hint || null,
                synonyms: formData.synonyms || [],
                isNew: false,
                variations: variations.length > 0 ? variations : null,
                intoleranceIds: selectedIntoleranceIds,
                intolerances: selectedIntoleranceIds.map(id => ({
                    id,
                    probability: aiIntoleranceProbabilities[id] !== undefined ? aiIntoleranceProbabilities[id] : 100
                }))
            };
            if (product?.id) {
                if (product.isInbox) {
                    await api.post(`/products/${product.id}/globalize`, dataToSave);
                } else {
                    await api.put(`/products/${product.id}`, dataToSave);
                }
            } else {
                await api.post('/products', dataToSave);
            }
            onSave();
            onClose();
        } catch (err) {
            console.error('Failed to save product', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddVariation = () => {
        const usedIds = variations.map(v => Number(v.ProductVariantId));
        const unusedVariant = availableVariants.find(av => !usedIds.includes(av.id));

        if (!unusedVariant) {
            if (availableVariants.length === 0) {
                alert('Bitte lege erst Varianten unter Einstellungen > Produkte > Varianten an.');
            } else {
                alert('Alle verfügbaren Varianten wurden bereits hinzugefügt.');
            }
            return;
        }

        setVariations([...variations, {
            ProductVariantId: unusedVariant.id,
            category: formData.category,
            unit: formData.unit
        }]);
    };

    const handleUpdateVariation = (index, field, value) => {
        const newVariations = [...variations];
        newVariations[index][field] = field === 'ProductVariantId' ? Number(value) : value;
        setVariations(newVariations);
    };

    const handleRemoveVariation = (index) => {
        setVariations(variations.filter((_, i) => i !== index));
    };

    const handleAnalyzeProduct = async () => {
        if (!formData.name) return;
        setAnalyzing(true);
        try {
            const { data } = await api.post('/ai/analyze-product', { productName: formData.name });

            if (data.hasVariants && data.variants && data.variants.length > 1) {
                setVariations(data.variants);
                setFormData(prev => ({ ...prev, category: '', unit: '' }));
            } else {
                setVariations([]);

                let fallbackCat = data.category;
                let fallbackUnit = data.unit;

                if (data.variants && data.variants.length === 1) {
                    fallbackCat = data.variants[0].category || fallbackCat;
                    fallbackUnit = data.variants[0].unit || fallbackUnit;
                }

                setFormData(prev => ({
                    ...prev,
                    category: fallbackCat || prev.category,
                    unit: fallbackUnit || prev.unit
                }));
            }

            if (data.intolerances) {
                const probs = {};
                data.intolerances.forEach(i => {
                    probs[i.id] = i.probability;
                });
                setAiIntoleranceProbabilities(probs);
            }

            if (data.intoleranceIds) {
                setSelectedIntoleranceIds(data.intoleranceIds);
            }
        } catch (err) {
            console.error('AI Analyze Error:', err);
            alert('Fehler bei der KI-Analyse: ' + (err.response?.data?.error || err.message));
        } finally {
            setAnalyzing(false);
        }
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
                        className="w-full max-w-lg relative z-10 max-h-[80vh] flex flex-col"
                    >
                        <Card className="p-4 sm:p-8 border-border shadow-2xl bg-card transition-colors duration-300 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between mb-4 sm:mb-8 shrink-0">
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
                                    <div className="p-1.5 sm:p-2 bg-primary rounded-lg shrink-0">
                                        <Package size={18} className="text-primary-foreground sm:w-5 sm:h-5" />
                                    </div>
                                    <span className="truncate">{product ? (product.isInbox ? 'Globalisieren' : 'Bearbeiten') : 'Neues Produkt'}</span>
                                </h2>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReportContext({
                                                productId: product?.id,
                                                productName: formData.name,
                                                additionalContext: 'ProductModal'
                                            });
                                            setIsReportModalOpen(true);
                                        }}
                                        className="text-muted-foreground/40 hover:text-orange-500 p-1.5 rounded-lg transition-colors"
                                        title="Fehler melden"
                                    >
                                        <Flag size={20} />
                                    </button>
                                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar pb-2">

                                    {isReadOnly && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3 text-amber-600 dark:text-amber-400">
                                            <ShieldAlert size={18} />
                                            <p className="text-sm font-bold">Dieses globale Produkt ist schreibgeschützt.</p>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Produktname</label>
                                            {!isReadOnly && user?.role === 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={handleAnalyzeProduct}
                                                    disabled={analyzing || !formData.name}
                                                    className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                >
                                                    {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                    KI ausfüllen
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="z.B. Bio-Milch"
                                            required
                                            disabled={isReadOnly}
                                            className="bg-muted/50 border-border h-12"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Synonyme</label>
                                        <div className={cn(
                                            "bg-muted/30 border border-border rounded-xl p-2 transition-all",
                                            !isReadOnly && "focus-within:ring-2 focus-within:ring-primary/20",
                                            isReadOnly && "opacity-60 cursor-not-allowed"
                                        )}>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {formData.synonyms?.map((syn, idx) => (
                                                    <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-1 group">
                                                        {syn}
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSynonym(syn)}
                                                                className="hover:bg-primary/20 rounded-full p-0.5"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                            <input
                                                value={synonymInput}
                                                onChange={(e) => setSynonymInput(e.target.value)}
                                                onKeyDown={handleAddSynonym}
                                                disabled={isReadOnly}
                                                placeholder={formData.synonyms?.length > 0 || isReadOnly ? "" : "Synonym eingeben und Enter drücken..."}
                                                className="w-full bg-transparent border-none text-sm focus:outline-none p-1 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        {!isReadOnly && <p className="text-[10px] text-muted-foreground ml-1">Drücke Enter zum Hinzufügen</p>}
                                    </div>

                                    {variations.length > 0 ? (
                                        <div className="space-y-4">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Varianten-Konfiguration</label>
                                            <div className="space-y-3">
                                                {variations.map((v, idx) => (
                                                    <div key={idx} className="bg-muted/30 border border-border rounded-xl p-4 relative group">
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveVariation(idx)}
                                                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Variante</label>
                                                                <select
                                                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                                    value={v.ProductVariantId}
                                                                    disabled={isReadOnly}
                                                                    onChange={(e) => handleUpdateVariation(idx, 'ProductVariantId', e.target.value)}
                                                                >
                                                                    {availableVariants.map(av => {
                                                                        const isUsedElsewhere = variations.some((other, i) => i !== idx && Number(other.ProductVariantId) === av.id);
                                                                        if (isUsedElsewhere) return null;
                                                                        return <option key={av.id} value={av.id}>{av.title}</option>;
                                                                    })}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Kategorie</label>
                                                                <input
                                                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                                    value={v.category}
                                                                    disabled={isReadOnly}
                                                                    onChange={(e) => handleUpdateVariation(idx, 'category', e.target.value)}
                                                                    placeholder="z.B. Obst"
                                                                    list="category-suggestions"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Einheit</label>
                                                                <input
                                                                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                                    value={v.unit}
                                                                    disabled={isReadOnly}
                                                                    onChange={(e) => handleUpdateVariation(idx, 'unit', e.target.value)}
                                                                    placeholder="kg, Stück..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategorie</label>
                                                    <Input
                                                        value={formData.category}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                        placeholder="z.B. Milchprodukte"
                                                        className="bg-muted/50 border-border h-12"
                                                        list="category-suggestions"
                                                    />
                                                    <datalist id="category-suggestions">
                                                        {categories.map(cat => <option key={cat} value={cat} />)}
                                                    </datalist>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Standard-Einheit</label>
                                                    <Input
                                                        value={formData.unit}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                        placeholder="z.B. Stück, kg, Packung"
                                                        className="bg-muted/50 border-border h-12"
                                                    />
                                                </div>
                                            </div>

                                            {!isReadOnly && availableVariants.length > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleAddVariation}
                                                    className="w-full gap-2 border-dashed border-2 py-6 rounded-xl text-primary hover:bg-primary/5 transition-all group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Plus size={18} />
                                                    </div>
                                                    <div className="flex flex-col items-start leading-tight">
                                                        <span className="font-bold">Varianten verwalten</span>
                                                        <span className="text-[10px] opacity-70">Zusätzliche Varianten für dieses Produkt definieren</span>
                                                    </div>
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {variations.length > 0 && !isReadOnly && (
                                        <div className="pt-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleAddVariation}
                                                className="w-full gap-2 text-primary font-bold hover:bg-primary/5"
                                            >
                                                <Plus size={16} /> Weitere Variante hinzufügen
                                            </Button>
                                        </div>
                                    )}

                                    <div className="space-y-3 pt-6">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <ShieldAlert size={14} className="text-primary" />
                                            Unverträglichkeiten
                                        </label>

                                        <div className={cn(
                                            "bg-muted/30 border border-border rounded-xl p-3 space-y-3",
                                            isReadOnly && "opacity-60 cursor-not-allowed"
                                        )}>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedIntoleranceIds.map(id => {
                                                    const intol = allIntolerances.find(i => i.id === id);
                                                    if (!intol) return null;
                                                    return (
                                                        <span
                                                            key={id}
                                                            className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg text-sm flex items-center gap-1.5 animate-in fade-in zoom-in duration-200"
                                                        >
                                                            <span className="font-medium">
                                                                {intol.warningText || intol.name}
                                                                {aiIntoleranceProbabilities[id] !== undefined && (
                                                                    <span className="opacity-60 text-[10px] ml-1 font-bold">
                                                                        {aiIntoleranceProbabilities[id]}%
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {!isReadOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedIntoleranceIds(prev => prev.filter(i => i !== id))}
                                                                    className="hover:bg-red-500/20 rounded-full p-0.5 transition-colors"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                                {selectedIntoleranceIds.length === 0 && (
                                                    <span className="text-xs text-muted-foreground italic p-1">Keine Unverträglichkeiten ausgewählt</span>
                                                )}
                                            </div>

                                            {!isReadOnly && (
                                                <select
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer hover:border-primary/30 transition-colors"
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        if (val && !selectedIntoleranceIds.includes(val)) {
                                                            setSelectedIntoleranceIds(prev => [...prev, val]);
                                                        }
                                                        e.target.value = "";
                                                    }}
                                                    value=""
                                                >
                                                    <option value="" disabled>Unverträglichkeit hinzufügen...</option>
                                                    {allIntolerances
                                                        .filter(i => !selectedIntoleranceIds.includes(i.id))
                                                        .map(i => (
                                                            <option key={i.id} value={i.id}>
                                                                {i.warningText || i.name}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3 shrink-0 border-t border-border mt-2 bg-card">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        className="h-12 px-6"
                                    >
                                        {isReadOnly ? 'Schließen' : 'Abbrechen'}
                                    </Button>

                                    <div className="flex-1" />

                                    {!isReadOnly && (
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="h-12 gap-2 px-4 sm:px-8"
                                        >
                                            <Save size={18} />
                                            <span className="hidden sm:inline">
                                                {loading
                                                    ? 'Speichern...'
                                                    : product?.isInbox
                                                        ? 'Als global übernehmen'
                                                        : 'Speichern'}
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </Card>
                    </motion.div>
                </div>
            )}

            <ReportIssueModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                productContext={reportContext}
            />
        </AnimatePresence>
    );
}
