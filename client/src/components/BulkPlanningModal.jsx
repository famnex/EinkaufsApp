import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Check, ShoppingCart, ChevronDown, ChevronUp, AlertCircle, Plus, Trash2, ArrowRight, RefreshCw, Search } from 'lucide-react';
import { Button } from './Button';
import { UnitCombobox } from './UnitCombobox';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { Input } from './Input';

// Helper to safely get adjustment value
const getAdj = (prodId, adjustments) => adjustments[prodId] || { quantity: '', unit: '', note: '' };

export default function BulkPlanningModal({ isOpen, onClose, listId, onConfirm }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null); // { range: {start, end}, ingredients: [] }
    const [adjustments, setAdjustments] = useState({}); // ProductId -> { quantity, unit, note }
    const [substitutions, setSubstitutions] = useState({}); // Original ProductId -> Substitute Product object
    const [availableUnits, setAvailableUnits] = useState([]);
    const [noteSuggestions, setNoteSuggestions] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [searchingFor, setSearchingFor] = useState(null); // ProductId being swapped
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && listId) {
            fetchPlanningData();
            fetchAvailableUnits();
            fetchAllProducts();
            fetchSubstitutions();
            setAdjustments({});
            setSearchingFor(null);
            setSearchTerm('');
        }
    }, [isOpen, listId]);

    const fetchPlanningData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/lists/${listId}/planning-data`);
            setData(res.data);

            // Auto-fill logic? User seems to want manual control or "One Click" copy.
            // Let's NOT auto-fill `adjustments`. Keep it clean.
            // User can click "Add" to copy.

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableUnits = async () => {
        try {
            const res = await api.get('/products/units');
            setAvailableUnits(res.data);
        } catch (err) {
            console.error('Failed to load units:', err);
        }
    };

    const fetchAllProducts = async () => {
        try {
            const res = await api.get('/products');
            setAllProducts(res.data);
            const uniqueNotes = [...new Set(res.data.map(p => p.note).filter(Boolean))].sort();
            setNoteSuggestions(uniqueNotes);
        } catch (err) {
            console.error('Failed to load products:', err);
        }
    };

    const fetchSubstitutions = async () => {
        try {
            const res = await api.get(`/lists/${listId}/substitutions`);
            // Convert array to map: originalProductId -> SubstituteProduct
            const subsMap = {};
            res.data.forEach(sub => {
                subsMap[sub.originalProductId] = sub.SubstituteProduct;
            });
            setSubstitutions(subsMap);
        } catch (err) {
            console.error('Failed to load substitutions:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const itemsToSave = Object.entries(adjustments)
                .filter(([_, val]) => parseFloat(val.quantity) > 0)
                .map(([origProdId, val]) => {
                    const effectiveProductId = substitutions[origProdId]?.id || parseInt(origProdId);
                    return {
                        ProductId: effectiveProductId,
                        quantity: parseFloat(val.quantity),
                        unit: val.unit
                    };
                });

            // Save notes to products
            for (const [origProdId, val] of Object.entries(adjustments)) {
                if (val.note && val.note.trim()) {
                    const effectiveProductId = substitutions[origProdId]?.id || parseInt(origProdId);
                    try {
                        await api.put(`/products/${effectiveProductId}`, { note: val.note });
                    } catch (err) {
                        console.error('Failed to save product note:', err);
                    }
                }
            }

            if (itemsToSave.length > 0) {
                await api.post(`/lists/${listId}/bulk-items`, { items: itemsToSave });
            }

            onConfirm();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('Diesen Artikel wirklich von der Liste entfernen?')) return;
        try {
            await api.delete(`/lists/items/${itemId}`);
            fetchPlanningData(); // Refresh to update "onList" status
        } catch (err) {
            alert('Löschen fehlgeschlagen');
        }
    };

    const handleQuickAdd = (prodId, amount, unit, note = '') => {
        setAdjustments(prev => ({
            ...prev,
            [prodId]: { quantity: amount, unit: unit, note: note }
        }));
    };

    const handleManualChange = (prodId, field, value) => {
        setAdjustments(prev => {
            const current = prev[prodId] || { quantity: '', unit: '', note: '' };
            return {
                ...prev,
                [prodId]: { ...current, [field]: value }
            };
        });
    };

    const clearAdjustment = (prodId) => {
        setAdjustments(prev => {
            const n = { ...prev };
            delete n[prodId];
            return n;
        });
    };

    const handleSubstitute = async (origProdId, newProduct) => {
        setSubstitutions(prev => ({
            ...prev,
            [origProdId]: newProduct
        }));
        setSearchingFor(null);

        // Save to backend
        try {
            await api.post(`/lists/${listId}/substitutions`, {
                originalProductId: origProdId,
                substituteProductId: newProduct.id
            });
        } catch (err) {
            console.error('Failed to save substitution:', err);
        }
    };

    const clearSubstitution = async (origProdId) => {
        const substituteProduct = substitutions[origProdId];

        setSubstitutions(prev => {
            const n = { ...prev };
            delete n[origProdId];
            return n;
        });

        // Delete from backend
        try {
            await api.delete(`/lists/${listId}/substitutions/${origProdId}`);

            // Also delete the substitute product from the list if it exists
            if (substituteProduct && data) {
                // Find items in the list with the substitute product ID
                const itemsToDelete = data.ingredients?.filter(
                    ing => ing.onListId && ing.product.id === origProdId
                );

                // Delete each item
                for (const item of itemsToDelete || []) {
                    if (item.onListId) {
                        try {
                            await api.delete(`/lists/items/${item.onListId}`);
                        } catch (err) {
                            console.error('Failed to delete list item:', err);
                        }
                    }
                }

                // Refresh planning data to update UI
                fetchPlanningData();
            }
        } catch (err) {
            console.error('Failed to delete substitution:', err);
        }
    };



    // --- Swipe/Hide Logic ---
    const [hiddenIngredients, setHiddenIngredients] = useState(new Set());

    const handleHide = (prodId) => {
        setHiddenIngredients(prev => {
            const next = new Set(prev);
            next.add(prodId);
            return next;
        });
    };

    // --- End Swipe/Hide Logic ---

    // Filter out hidden items for rendering (but keep data intact)
    const visibleIngredients = data?.ingredients.filter(item => !hiddenIngredients.has(item.product.id)) || [];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    className="w-full max-w-5xl bg-card border border-border rounded-t-[2.5rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="px-5 py-4 md:p-6 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bebas tracking-wider text-primary">Zutaten Planer</h2>
                            {data && (
                                <p className="text-[10px] md:text-sm text-muted-foreground uppercase tracking-widest font-bold">
                                    <span className="opacity-50">Zeitraum:</span> {new Date(data.range.start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} — {new Date(data.range.end).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <button onClick={onClose} className="p-3 bg-muted/50 hover:bg-muted rounded-2xl transition-all duration-200">
                            <X size={20} className="text-muted-foreground" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/10">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {data?.ingredients.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground italic">
                                        Keine Menüs in diesem Zeitraum gefunden.
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            <div className="col-span-4">Produkt</div>
                                            <div className="col-span-3 text-center">Benötigt</div>
                                            <div className="col-span-2 text-center">Vorhanden</div>
                                            <div className="col-span-3 pl-4">Hinzufügen</div>
                                        </div>

                                        {visibleIngredients
                                            .sort((a, b) => a.product.name.localeCompare(b.product.name))
                                            .map(item => (
                                                <PlanningRow
                                                    key={item.product.id}
                                                    item={item}
                                                    adjustments={adjustments}
                                                    substitutions={substitutions}
                                                    searchingFor={searchingFor}
                                                    searchTerm={searchTerm}
                                                    allProducts={allProducts}
                                                    visibleIngredients={visibleIngredients /* just for context if needed */}
                                                    // Handlers
                                                    onHide={() => handleHide(item.product.id)}
                                                    onQuickAdd={handleQuickAdd}
                                                    onManualChange={handleManualChange}
                                                    getAdj={getAdj}
                                                    availableUnits={availableUnits}
                                                    noteSuggestions={noteSuggestions}
                                                    onClearAdjustment={clearAdjustment}
                                                    onSubstitute={handleSubstitute}
                                                    onClearSubstitution={clearSubstitution}
                                                    onSetSearchingFor={setSearchingFor}
                                                    onSetSearchTerm={setSearchTerm}
                                                    onDeleteItem={handleDeleteItem}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 md:p-5 border-t border-border bg-card/80 backdrop-blur-md flex flex-row justify-end items-center gap-3">
                        <div className="hidden md:block mr-auto text-xs text-muted-foreground font-medium uppercase tracking-widest">
                            {Object.keys(adjustments).length} {Object.keys(adjustments).length === 1 ? 'Artikel' : 'Artikel'} vorgemerkt
                        </div>

                        {/* Cancel Button - Icon only on mobile */}
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="w-12 h-12 md:w-auto md:h-10 rounded-2xl md:px-4"
                        >
                            <X size={20} className="md:mr-2" />
                            <span className="hidden md:inline">Abbrechen</span>
                        </Button>

                        {/* Save Button - Icon only on mobile, wider on desktop */}
                        <Button
                            onClick={handleSave}
                            disabled={saving || Object.keys(adjustments).length === 0}
                            className="flex-1 md:flex-none md:min-w-[200px] h-12 md:h-10 rounded-2xl shadow-xl shadow-primary/20 backdrop-blur-xl transition-all"
                        >
                            {saving ? (
                                <RefreshCw className="animate-spin" size={20} />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <ShoppingCart size={20} />
                                    <span className="hidden md:inline">Liste aktualisieren</span>
                                    {/* Mobile count badge */}
                                    <span className="md:hidden bg-white/20 px-2 py-0.5 rounded-lg text-xs font-black">
                                        {Object.keys(adjustments).length}
                                    </span>
                                </div>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function PlanningRow({
    item, adjustments, substitutions, searchingFor, searchTerm, allProducts,
    onHide, onQuickAdd, onManualChange, getAdj, availableUnits, noteSuggestions,
    onClearAdjustment, onSubstitute, onClearSubstitution, onSetSearchingFor, onSetSearchTerm, onDeleteItem
}) {
    const adj = getAdj(item.product.id, adjustments);
    const isSelected = adj.quantity !== '';

    // Primary need (single unit) support
    const primaryNeed = item.primaryNeed;
    const neededText = item.totalNeededText;
    const onList = parseFloat(item.onList);
    const onListId = item.onListId;
    const onListUnit = item.onListUnit;

    // Default unit suggestion:
    // If on list, MUST use list unit.
    // Else use item/product unit.
    const defaultUnit = onList > 0 && onListUnit
        ? onListUnit
        : (item.unit || item.product.unit || 'Stück');

    const isLockedUnit = onList > 0;

    // Motion Stuff
    const x = useMotionValue(0);
    // Background opacity: 0 -> 1 as we drag left (0 to -100)
    const bgOpacity = useTransform(x, [0, -60], [0, 1]);
    // Icon scale/opacity
    const iconScale = useTransform(x, [0, -60], [0.5, 1]);

    // We check drag end
    const handleDragEnd = (event, info) => {
        // If dragged far enough left (e.g. -100px)
        if (info.offset.x < -100) {
            onHide();
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="relative"
        >
            {/* Red Background for Swipe */}
            <motion.div
                style={{ opacity: bgOpacity }}
                className="absolute inset-0 bg-red-500/10 rounded-3xl flex items-center justify-end pr-6 border border-red-500/20"
            >
                <motion.div style={{ scale: iconScale, opacity: bgOpacity }}>
                    <X className="text-red-500" size={24} />
                </motion.div>
            </motion.div>

            <motion.div
                style={{ x }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }} // We only want elastic drag left
                dragElastic={{ left: 0.5, right: 0.05 }}
                onDragEnd={handleDragEnd}
                className={cn(
                    "group relative flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-4 items-stretch md:items-center p-4 md:p-3 rounded-3xl border border-border transition-colors duration-300 bg-card z-10 touch-pan-y",
                    isSelected ? "bg-primary/[0.03] border-primary/30 shadow-md ring-1 ring-primary/10" : "hover:bg-muted/30"
                )}
            >
                {/* Desktop 'X' Button Overlay - Positioned relative to this card to be clickable */}
                <button
                    onClick={(e) => { e.stopPropagation(); onHide(); }}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-card border border-border shadow-sm rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 hidden md:flex z-50 shadow-sm"
                    title="Zeile ausblenden"
                >
                    <X size={14} />
                </button>


                {/* Product Info Section */}
                <div className="w-full md:col-span-4 min-w-0 flex flex-col gap-2">
                    <div className="flex items-start md:items-center gap-3">
                        <button
                            onClick={() => substitutions[item.product.id] ? onClearSubstitution(item.product.id) : onSetSearchingFor(item.product.id)}
                            className={cn(
                                "shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-2xl flex items-center justify-center transition-all duration-300",
                                substitutions[item.product.id] ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <RefreshCw size={16} className={cn(searchingFor === item.product.id && "animate-spin")} />
                        </button>
                        <div className="min-w-0 flex-1">
                            {searchingFor === item.product.id ? (
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                    <Input
                                        autoFocus
                                        placeholder="Ersatzprodukt..."
                                        className="pl-8 h-9 text-sm bg-muted border-none rounded-xl"
                                        value={searchTerm}
                                        onChange={(e) => onSetSearchTerm(e.target.value)}
                                        onBlur={() => setTimeout(() => { onSetSearchingFor(null); onSetSearchTerm(''); }, 200)}
                                    />
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-30 ring-1 ring-black/5">
                                        {allProducts
                                            .filter(p => p.id !== item.product.id && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .slice(0, 10)
                                            .map(p => (
                                                <button
                                                    key={p.id}
                                                    className="w-full text-left px-4 py-3 hover:bg-primary/5 text-sm font-medium border-b border-border/50 last:border-none"
                                                    onMouseDown={() => { onSubstitute(item.product.id, p); onSetSearchTerm(''); }}
                                                >
                                                    {p.name}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={cn("font-bold truncate text-base md:text-sm leading-tight", substitutions[item.product.id] && "line-through opacity-50")}>
                                        {item.product.name}
                                    </div>
                                    {substitutions[item.product.id] && (
                                        <div className="font-bold text-primary truncate text-sm flex items-center gap-1 mt-0.5 animate-in fade-in slide-in-from-left-2">
                                            <ArrowRight size={12} className="shrink-0" />
                                            <span className="truncate">{substitutions[item.product.id].name}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onClearSubstitution(item.product.id); }}
                                                className="ml-auto w-5 h-5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                    {item.product.Store?.name && (
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-0.5">
                                            {item.product.Store.name}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.sources.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-muted/40 rounded-lg text-[10px] text-muted-foreground/80 font-medium" title={s.recipe}>
                                {s.recipe}
                            </span>
                        ))}
                        {item.sources.length > 3 && <span className="text-[10px] font-bold text-primary">+{item.sources.length - 3}</span>}
                    </div>
                </div>

                {/* Status Section (Mobile: Row, Desktop: Grid columns) */}
                <div className="grid grid-cols-2 md:contents gap-4 pt-2 md:pt-0 border-t border-border/50 md:border-none">
                    {/* Needed */}
                    <div className="flex flex-col md:col-span-3 items-start md:items-center justify-center">
                        <span className="md:hidden text-[10px] uppercase font-bold text-muted-foreground mb-1">Benötigt</span>
                        <span className="font-mono font-bold text-sm bg-primary/10 text-primary md:bg-muted/30 md:text-foreground px-3 py-1.5 rounded-2xl w-full md:w-auto text-center">
                            {neededText}
                        </span>
                    </div>

                    {/* Presence */}
                    <div className="flex flex-col md:col-span-2 items-start md:items-center justify-center gap-2">
                        <span className="md:hidden text-[10px] uppercase font-bold text-muted-foreground mb-1">Vorhanden</span>
                        <div className="flex items-center gap-2 w-full md:justify-center">
                            {onList > 0 ? (
                                <div className="flex items-center gap-2 bg-teal-500/10 text-teal-600 px-3 py-1.5 rounded-2xl w-full md:w-auto md:bg-transparent md:px-0 md:py-0">
                                    <Check size={14} className="shrink-0" />
                                    <span className="font-mono font-bold text-sm truncate">{onList} {onListUnit || item.product.unit}</span>
                                    {onListId && (
                                        <button
                                            onClick={() => onDeleteItem(onListId)}
                                            className="ml-auto md:ml-2 text-red-500/50 hover:text-red-500 p-1 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <span className="text-muted-foreground/20 font-bold hidden md:block">—</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Section */}
                <div className="md:col-span-3 flex flex-col gap-2 mt-2 md:mt-0">
                    <span className="md:hidden text-[10px] uppercase font-bold text-muted-foreground">Hinzufügen</span>
                    <div className="flex items-center gap-2">
                        {/* Quick Add Pills */}
                        {!isLockedUnit && !isSelected && (
                            <div className="flex items-center gap-2 w-full">
                                {primaryNeed && (
                                    <button
                                        onClick={() => onQuickAdd(item.product.id, primaryNeed.amount, primaryNeed.unit)}
                                        className="flex-1 h-10 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Plus size={14} /> {primaryNeed.amount} {primaryNeed.unit}
                                    </button>
                                )}
                                {!(primaryNeed && primaryNeed.amount === 1 && primaryNeed.unit === defaultUnit) && (
                                    <button
                                        onClick={() => onQuickAdd(item.product.id, 1, defaultUnit)}
                                        className="flex-1 h-10 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-2xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Plus size={14} /> 1 {defaultUnit}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Manual Adjustment Area */}
                        {(isSelected || isLockedUnit) && (
                            <div className="flex flex-col gap-2 w-full animate-in fade-in zoom-in-95">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            className="h-10 text-center font-black rounded-2xl border-2 border-primary bg-primary/5 text-primary focus:ring-4 focus:ring-primary/20"
                                            value={adj.quantity}
                                            placeholder={isLockedUnit ? "+0" : "0"}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                onManualChange(item.product.id, 'quantity', val);
                                                if (!adj.unit) onManualChange(item.product.id, 'unit', defaultUnit);
                                            }}
                                        />
                                    </div>
                                    <UnitCombobox
                                        value={adj.unit || ''}
                                        onChange={(val) => onManualChange(item.product.id, 'unit', val)}
                                        suggestions={availableUnits}
                                        disabled={isLockedUnit}
                                        className="w-24 h-10 rounded-2xl"
                                    />
                                    {isSelected && (
                                        <button
                                            onClick={() => onClearAdjustment(item.product.id)}
                                            className="w-10 h-10 rounded-2xl bg-muted/50 text-muted-foreground hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                                {isSelected && (
                                    <Input
                                        placeholder="Optionaler Hinweis..."
                                        value={adj.note || ''}
                                        onChange={(e) => onManualChange(item.product.id, 'note', e.target.value)}
                                        className="h-9 text-xs rounded-xl bg-muted/30 border-none px-3"
                                        list={`note-suggestions-planner-${item.product.id}`}
                                    />
                                )}
                                <datalist id={`note-suggestions-planner-${item.product.id}`}>
                                    {noteSuggestions.map(n => <option key={n} value={n} />)}
                                </datalist>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
