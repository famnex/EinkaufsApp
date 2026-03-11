import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Check, ShoppingCart, ChevronDown, Plus, RefreshCw, Calendar, Trash2, ListPlus } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { useAuth } from '../contexts/AuthContext';
import ProductSubstituteModal from './ProductSubstituteModal';
import { useTutorial } from '../contexts/TutorialContext';
import { AlertCircle, HelpCircle } from 'lucide-react';

export default function RecipeToListModal({ isOpen, onClose, recipe }) {
    useLockBodyScroll(isOpen);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lists, setLists] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const [newListDate, setNewListDate] = useState(new Date().toISOString().split('T')[0]);
    const [servings, setServings] = useState(recipe?.servings || 2);
    const [plannedSettings, setPlannedSettings] = useState({ settings: {}, hiddenIngredients: [] });
    const [adjustments, setAdjustments] = useState({}); // ProductId -> { checked, unitType: 'recipe' | 'standard' }
    const [hiddenIds, setHiddenIds] = useState(new Set());
    const [intoleranceConflicts, setIntoleranceConflicts] = useState([]);
    const [localSubstitutions, setLocalSubstitutions] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [tooltipData, setTooltipData] = useState(null);

    // Substitute logic
    const { notifyAction } = useTutorial();
    const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
    const [substituteTarget, setSubstituteTarget] = useState(null);
    const [substituteSuggestions, setSubstituteSuggestions] = useState([]);
    const [substituteLoading, setSubstituteLoading] = useState(false);
    const [conflicts, setConflicts] = useState([]); // For substitute modal conflicts

    // Reset servings and local state when recipe changes
    useEffect(() => {
        if (recipe) {
            setServings(recipe.servings || 2);
            setHiddenIds(new Set());
            setLocalSubstitutions(null);
        }
    }, [recipe?.id]);

    useEffect(() => {
        if (isOpen && recipe) {
            fetchLists();
            setServings(recipe.servings || 2); // Ensure servings are reset on open if recipe hasn't changed
            fetchIntolerances();
            api.get('/products').then(res => setAllProducts(res.data)).catch(console.error);
        }
    }, [isOpen, recipe?.id]);

    useEffect(() => {
        if (selectedListId && recipe) {
            fetchPlannedSettings();
        }
    }, [selectedListId, recipe]);

    const fetchLists = async () => {
        try {
            const res = await api.get('/lists');
            const today = new Date().toISOString().split('T')[0];

            const activeLists = res.data
                .filter(l => l.status === 'active' && l.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date));

            setLists(activeLists);
            if (activeLists.length > 0) {
                setSelectedListId(activeLists[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch lists:', err);
        }
    };

    const fetchPlannedSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/lists/${selectedListId}/planned-recipes/${recipe.id}`);
            const data = res.data;
            setPlannedSettings(data);
            if (data.servings) {
                setServings(data.servings);
            } else if (recipe?.servings) {
                setServings(recipe.servings);
            }
            // Hidden ingredients from DB should reappear as unchecked
            const hiddenFromDb = new Set(data.hiddenIngredients || []);
            setHiddenIds(new Set()); // Always start with empty local hidden set

            // Initialize adjustments based on recipe ingredients and saved settings
            const initialAdjustments = {};
            recipe.RecipeIngredients.forEach(ri => {
                let saved = data.settings?.[ri.ProductId];

                if (!saved && hiddenFromDb.has(ri.ProductId)) {
                    saved = {
                        checked: false,
                        mode: 'recipe',
                        customQty: '',
                        customUnit: ''
                    };
                }

                if (!saved) {
                    saved = {
                        checked: !ri.isOptional,
                        mode: 'recipe',
                        customQty: '',
                        customUnit: ''
                    };
                }

                // Compatibility for old unitType field
                if (saved.unitType && !saved.mode) {
                    saved.mode = saved.unitType === 'recipe' ? 'recipe' : 'standard';
                    delete saved.unitType;
                }

                initialAdjustments[ri.ProductId] = saved;
            });
            setAdjustments(initialAdjustments);
        } catch (err) {
            console.error('Failed to fetch planned settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        try {
            const res = await api.get(`/substitutions/recipe/${recipe.id}`);
            setLocalSubstitutions(res.data);
            // Intolerances will be refreshed via useEffect on localSubstitutions or manual call
            fetchIntolerances(res.data);
        } catch (err) {
            console.error('Failed to refresh substitutions:', err);
        }
    };

    const fetchIntolerances = async (currentSubs = null) => {
        if (!user || !recipe?.RecipeIngredients) return;

        const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
            ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
            user?.tier?.includes('Admin') || user?.role === 'admin';

        if (!canAccessCheck) return;

        try {
            const activeSubs = currentSubs || localSubstitutions || recipe.substitutions || recipe.RecipeSubstitutions;
            const subProductIds = activeSubs?.map(s => s.substituteProductId).filter(Boolean) || [];
            const originalProductIds = recipe.RecipeIngredients.map(ri => ri.ProductId).filter(Boolean);
            const allCheckIds = [...new Set([...originalProductIds, ...subProductIds])];

            if (allCheckIds.length > 0) {
                const { data } = await api.post('/intolerances/check', { productIds: allCheckIds });
                setIntoleranceConflicts(data);
            }
        } catch (err) {
            console.error('Failed to fetch intolerance conflicts:', err);
        }
    };

    const handleOpenSubstituteModal = async (ri) => {
        notifyAction('product-swap');
        setSubstituteTarget(ri);
        setSubstituteModalOpen(true);
        setSubstituteLoading(true);
        setSubstituteSuggestions([]);

        try {
            const { data } = await api.post('/ai/suggest-substitute', {
                productName: ri.displayName,
                context: 'Rezeptplanung'
            });

            const suggestedProducts = data.suggestions || [];
            setSubstituteSuggestions(suggestedProducts);

            if (suggestedProducts.length > 0) {
                const productNames = suggestedProducts.map(s => s.name.toLowerCase());
                const matchingProducts = allProducts.filter(p => productNames.includes(p.name.toLowerCase()));

                if (matchingProducts.length > 0) {
                    const productIds = matchingProducts.map(p => p.id);
                    api.post('/intolerances/check', { productIds })
                        .then(res => setConflicts(res.data))
                        .catch(err => console.error("Failed to check substitute intolerances", err));
                }
            }
        } catch (err) {
            console.error('Failed to get AI suggestions:', err);
            setSubstituteModalOpen(false);
        } finally {
            setSubstituteLoading(false);
        }
    };

    const handleSelectSubstitute = async (suggestion) => {
        if (!window.confirm(`"${substituteTarget.displayName}" durch "${suggestion.name}" ersetzen?`)) return;

        try {
            let substituteProduct = allProducts.find(p => p.name.toLowerCase() === suggestion.name.toLowerCase());
            if (!substituteProduct) {
                const { data: newProduct } = await api.post('/products', {
                    name: suggestion.name,
                    category: (substituteTarget.Product || substituteTarget.displayProduct)?.category || 'Sonstiges',
                    unit: (substituteTarget.Product || substituteTarget.displayProduct)?.unit || 'Stück'
                });
                substituteProduct = newProduct;
                api.get('/products').then(res => setAllProducts(res.data));
            }

            await api.post('/substitutions', {
                recipeId: recipe.id,
                originalProductId: substituteTarget.ProductId,
                substituteProductId: substituteProduct.id,
                originalQuantity: substituteTarget.quantity,
                originalUnit: substituteTarget.unit,
                substituteQuantity: suggestion.quantity || substituteTarget.quantity,
                substituteUnit: suggestion.unit || substituteTarget.unit
            });

            setSubstituteModalOpen(false);
            refreshData();

        } catch (err) {
            console.error('Failed to save substitution:', err);
            alert('Fehler beim Speichern der Ersetzung');
        }
    };

    const handleSave = async () => {
        if (!selectedListId) return;
        setSaving(true);
        try {
            let listId = selectedListId;

            // 1. Create new list if needed
            if (selectedListId === 'new') {
                const newListRes = await api.post('/lists', {
                    date: newListDate,
                    name: `Einkauf ${new Date(newListDate).toLocaleDateString()}`
                });
                listId = newListRes.data.id;
            }

            const itemsToSave = processedIngredients
                .filter(ri => adjustments[ri.ProductId]?.checked && !hiddenIds.has(ri.ProductId))
                .map(ri => {
                    const adj = adjustments[ri.ProductId];
                    const baseServings = Number(recipe.servings) || 1;
                    const ratio = servings / baseServings;

                    let qty, unit;
                    if (adj.mode === 'recipe') {
                        qty = ri.displayQuantity * ratio;
                        unit = ri.displayUnit;
                    } else if (adj.mode === 'standard') {
                        qty = 1;
                        unit = ri.displayProduct?.unit || ri.displayUnit;
                    } else {
                        qty = parseFloat(adj.customQty) || 0;
                        unit = adj.customUnit || ri.displayUnit;
                    }

                    return {
                        ProductId: (ri.isSubstituted && ri.displayProduct) ? ri.displayProduct.id : ri.ProductId,
                        quantity: qty,
                        unit: unit,
                        note: `Rezept: ${recipe.title}`
                    };
                });

            await api.post(`/lists/${listId}/planned-recipes/${recipe.id}`, {
                servings,
                settings: adjustments,
                hiddenIngredients: [], // Clear hidden list so they reappear as unchecked next time
                items: itemsToSave
            });

            onClose();

        } catch (err) {
            console.error('Failed to save:', err);
            alert('Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const toggleIngredient = (prodId) => {
        setAdjustments(prev => ({
            ...prev,
            [prodId]: { ...prev[prodId], checked: !prev[prodId].checked }
        }));
    };

    const updateAdjustment = (prodId, fields) => {
        setAdjustments(prev => ({
            ...prev,
            [prodId]: { ...prev[prodId], ...fields }
        }));
    };

    const handleHide = (id) => {
        setHiddenIds(prev => new Set(prev).add(id));
        updateAdjustment(id, { checked: false });
    };

    if (!isOpen) return null;

    const subMap = {};
    const effectiveSubs = localSubstitutions || recipe.substitutions || recipe.RecipeSubstitutions;
    effectiveSubs?.forEach(sub => {
        if (sub.originalProductId) {
            subMap[sub.originalProductId] = {
                name: sub.SubstituteProduct?.name || (sub.isOmitted ? 'Ausgelassen' : 'Unbekannt'),
                quantity: sub.substituteQuantity,
                unit: sub.substituteUnit,
                isOmitted: sub.isOmitted,
                productId: sub.substituteProductId,
                substituteProduct: sub.SubstituteProduct
            };
        }
    });

    const processedIngredients = recipe?.RecipeIngredients?.map(ri => {
        const sub = subMap[ri.ProductId];
        return {
            ...ri,
            displayProduct: sub ? sub.substituteProduct : ri.Product,
            displayName: sub ? sub.name : (ri.Product?.name || ri.originalName),
            displayQuantity: sub && sub.quantity !== null ? sub.quantity : ri.quantity,
            displayUnit: (sub && sub.unit) ? sub.unit : (ri.unit || ri.Product?.unit),
            isSubstituted: !!sub,
            conflict: intoleranceConflicts.find(c => Number(c.productId) === Number(sub ? sub.productId : ri.ProductId))
        };
    }) || [];

    const visibleIngredients = processedIngredients.filter(ri => !hiddenIds.has(ri.ProductId)) || [];
    const isUpdating = plannedSettings && plannedSettings.id;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bebas tracking-wide text-primary">
                                {isUpdating ? 'Einkaufsliste ändern' : 'Zur Einkaufsliste hinzufügen'}
                            </h2>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-none">{recipe?.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Portions & List Selection */}
                    <div className="p-4 bg-muted/20 border-b border-border grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Portionen</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setServings(Math.max(1, servings - 1))} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center">-</button>
                                <span className="font-bold text-lg w-8 text-center">{servings}</span>
                                <button onClick={() => setServings(servings + 1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center">+</button>
                                <span className="text-[10px] text-muted-foreground ml-1">
                                    (Basis: {recipe?.servings || 1})
                                </span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Einkaufsliste</label>
                            <select
                                value={selectedListId}
                                onChange={(e) => setSelectedListId(e.target.value)}
                                className="w-full h-10 px-3 bg-card border border-border rounded-xl text-sm font-bold"
                            >
                                {lists.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.name || (new Date(l.date).toLocaleDateString())}
                                    </option>
                                ))}
                                <option value="new">+ Neue Liste erstellen</option>
                            </select>
                        </div>
                        {selectedListId === 'new' && (
                            <div className="col-span-2 pt-2 animate-in slide-in-from-top-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Datum für neue Liste</label>
                                <Input
                                    type="date"
                                    value={newListDate}
                                    onChange={(e) => setNewListDate(e.target.value)}
                                    className="h-10 font-bold"
                                />
                            </div>
                        )}
                    </div>

                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-2"
                        onScroll={() => setTooltipData(null)}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <RefreshCw className="animate-spin text-primary" />
                            </div>
                        ) : (
                            visibleIngredients.map(ri => {
                                const baseServings = Number(recipe?.servings) || 1;
                                const servingsRatio = servings / baseServings;
                                return (
                                    <IngredientRow
                                        key={ri.id}
                                        ri={ri}
                                        adjustment={adjustments[ri.ProductId] || { checked: true, mode: 'recipe', customQty: '', customUnit: '' }}
                                        servingsRatio={servingsRatio}
                                        onToggle={() => toggleIngredient(ri.ProductId)}
                                        onUpdate={(fields) => updateAdjustment(ri.ProductId, fields)}
                                        onHide={() => handleHide(ri.ProductId)}
                                        onDoubleTap={() => handleOpenSubstituteModal(ri)}
                                        setTooltipData={setTooltipData}
                                        tooltipData={tooltipData}
                                    />
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={onClose}>Abbrechen</Button>
                        <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !selectedListId}>
                            {saving ? <RefreshCw size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                            {isUpdating ? 'Änderung speichern' : 'Hinzufügen'}
                        </Button>
                    </div>
                </motion.div>

                <AnimatePresence>
                    {tooltipData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="fixed z-[99999] w-64 p-3 bg-card/98 backdrop-blur-xl text-card-foreground rounded-2xl shadow-2xl border border-border text-xs pointer-events-none"
                            style={{
                                left: Math.max(140, Math.min(window.innerWidth - 140, tooltipData.x)),
                                top: tooltipData.y - 12,
                                transform: 'translate(-50%, -100%)'
                            }}
                        >
                            <div className={cn(
                                "font-bold mb-2 flex items-center gap-2",
                                tooltipData.maxProb >= 80 ? "text-destructive" : "text-orange-500"
                            )}>
                                {tooltipData.maxProb >= 80 ? <AlertCircle size={16} /> : <HelpCircle size={16} />}
                                {tooltipData.maxProb >= 80 ? 'Achtung!' : 'Hinweis'} ({tooltipData.maxProb}%)
                            </div>
                            <div className="text-muted-foreground mb-2 text-[10px] uppercase font-bold tracking-wider opacity-70">
                                Unverträglichkeit erkannt:
                            </div>
                            <div className="space-y-1">
                                {tooltipData.warnings.map((w, idx) => (
                                    <div key={idx} className={cn(
                                        "flex items-start gap-2 text-[11px] font-semibold p-2 rounded-lg border leading-tight",
                                        tooltipData.maxProb >= 80 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                    )}>
                                        <span>{w.message}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {substituteTarget && (
                    <ProductSubstituteModal
                        isOpen={substituteModalOpen}
                        onClose={() => setSubstituteModalOpen(false)}
                        originalProduct={substituteTarget.Product || { name: substituteTarget.originalName }}
                        suggestions={substituteSuggestions}
                        loading={substituteLoading}
                        onSelect={handleSelectSubstitute}
                        conflicts={conflicts}
                        allProducts={allProducts}
                    />
                )}
            </div>
        </AnimatePresence>
    );
}

function IngredientRow({ ri, adjustment, servingsRatio, onToggle, onUpdate, onHide, onDoubleTap, setTooltipData, tooltipData }) {
    const lastTapTimeRef = useRef(0);
    const x = useMotionValue(0);
    const bgOpacity = useTransform(x, [0, -60], [0, 1]);

    const finalDisplayQty = (ri.displayQuantity * servingsRatio).toFixed(1).replace('.0', '');
    const standardUnit = ri.Product?.unit || ri.unit;

    return (
        <div className="relative group overflow-hidden rounded-2xl border border-border bg-card">
            {/* Swipe Background */}
            <motion.div
                style={{ opacity: bgOpacity }}
                className="absolute inset-0 bg-red-500/10 flex items-center justify-end pr-6 border border-red-500/20 rounded-2xl"
            >
                <Trash2 className="text-red-500" size={20} />
            </motion.div>

            <motion.div
                style={{ x }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0.1 }}
                onDragEnd={(_, info) => info.offset.x < -80 && onHide()}
                onClick={() => {
                    const now = Date.now();
                    if (now - lastTapTimeRef.current < 300) {
                        onDoubleTap();
                        lastTapTimeRef.current = 0;
                    } else {
                        lastTapTimeRef.current = now;
                    }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleTap();
                }}
                className={cn(
                    "relative p-3 flex flex-col gap-3 transition-colors bg-card",
                    !adjustment.checked && "opacity-50"
                )}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggle}
                        className={cn(
                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
                            adjustment.checked ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                        )}
                    >
                        {adjustment.checked && <Check size={14} />}
                    </button>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="font-bold text-sm truncate">{ri.displayName}</div>
                            {ri.conflict && ri.conflict.warnings && ri.conflict.warnings.length > 0 && (() => {
                                const maxProb = ri.conflict.warnings.reduce((max, w) => Math.max(max, w.probability || 0), 0);
                                if (maxProb <= 30) return null;
                                return (
                                    <div className="relative isolate">
                                        <div
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setTooltipData({
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top,
                                                    maxProb,
                                                    warnings: ri.conflict.warnings,
                                                    id: ri.id
                                                });
                                            }}
                                            onMouseLeave={() => setTooltipData(null)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (tooltipData?.id === ri.id) setTooltipData(null);
                                                else {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltipData({
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top,
                                                        maxProb,
                                                        warnings: ri.conflict.warnings,
                                                        id: ri.id
                                                    });
                                                }
                                            }}
                                            className="cursor-help p-1 -m-1"
                                        >
                                            {maxProb >= 80 ? (
                                                <AlertCircle size={14} className="text-destructive animate-pulse" />
                                            ) : (
                                                <HelpCircle size={14} className="text-orange-500" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        {ri.isSubstituted && (
                            <div className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
                                <RefreshCw size={10} /> personalisierte Ersetzung
                            </div>
                        )}
                    </div>
                </div>

                {adjustment.checked && (
                    <div className="pl-9 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-wrap gap-2">
                            {/* Option 1: Recipe Unit */}
                            <label className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all",
                                adjustment.mode === 'recipe' ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" : "border-border hover:bg-muted"
                            )}>
                                <input
                                    type="radio"
                                    className="sr-only"
                                    name={`mode-${ri.id}`}
                                    checked={adjustment.mode === 'recipe'}
                                    onChange={() => onUpdate({ mode: 'recipe' })}
                                />
                                {finalDisplayQty} {ri.displayUnit}
                            </label>

                            {/* Option 2: Standard Unit */}
                            <label className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all",
                                adjustment.mode === 'standard' ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" : "border-border hover:bg-muted"
                            )}>
                                <input
                                    type="radio"
                                    className="sr-only"
                                    name={`mode-${ri.id}`}
                                    checked={adjustment.mode === 'standard'}
                                    onChange={() => onUpdate({ mode: 'standard' })}
                                />
                                1 {ri.displayUnit}
                            </label>

                            {/* Option 3: Custom */}
                            <label className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all",
                                adjustment.mode === 'custom' ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" : "border-border hover:bg-muted"
                            )}>
                                <input
                                    type="radio"
                                    className="sr-only"
                                    name={`mode-${ri.id}`}
                                    checked={adjustment.mode === 'custom'}
                                    onChange={() => onUpdate({ mode: 'custom' })}
                                />
                                Eigene Angabe
                            </label>
                        </div>

                        {adjustment.mode === 'custom' && (
                            <div className="flex gap-2 animate-in zoom-in-95">
                                <Input
                                    type="number"
                                    placeholder="Menge"
                                    value={adjustment.customQty}
                                    onChange={(e) => onUpdate({ customQty: e.target.value })}
                                    className="h-8 text-xs w-20 px-2"
                                />
                                <Input
                                    placeholder="Einheit (z.B. Dose)"
                                    value={adjustment.customUnit}
                                    onChange={(e) => onUpdate({ customUnit: e.target.value })}
                                    className="h-8 text-xs flex-1 px-2"
                                />
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
