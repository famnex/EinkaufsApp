import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingCart, ChevronDown, ChevronUp, AlertCircle, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { UnitCombobox } from './UnitCombobox';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { Input } from './Input';

// Helper to safely get adjustment value
const getAdj = (prodId, adjustments) => adjustments[prodId] || { quantity: '', unit: '' };

export default function BulkPlanningModal({ isOpen, onClose, listId, onConfirm }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null); // { range: {start, end}, ingredients: [] }
    const [adjustments, setAdjustments] = useState({}); // ProductId -> { quantity, unit }
    const [availableUnits, setAvailableUnits] = useState([]); // Dynamic units from products

    useEffect(() => {
        if (isOpen && listId) {
            fetchPlanningData();
            fetchAvailableUnits();
            setAdjustments({});
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const itemsToSave = Object.entries(adjustments)
                .filter(([_, val]) => parseFloat(val.quantity) > 0)
                .map(([prodId, val]) => ({
                    ProductId: parseInt(prodId),
                    quantity: parseFloat(val.quantity),
                    unit: val.unit
                }));

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

    const handleQuickAdd = (prodId, amount, unit) => {
        setAdjustments(prev => ({
            ...prev,
            [prodId]: { quantity: amount, unit: unit }
        }));
    };

    const handleManualChange = (prodId, field, value) => {
        setAdjustments(prev => {
            const current = prev[prodId] || { quantity: '', unit: '' };
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

    // Units are now loaded dynamically from backend

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-5xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-4 md:p-6 border-b border-border bg-card flex justify-between items-center">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bebas tracking-wide">Zutaten Planer</h2>
                            {data && (
                                <p className="text-xs md:text-sm text-muted-foreground">
                                    Zeitraum: <span className="font-bold text-primary">{new Date(data.range.start).toLocaleDateString('de-DE')}</span> bis <span className="font-bold text-primary">{new Date(data.range.end).toLocaleDateString('de-DE')}</span>
                                </p>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                            <X size={24} />
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

                                        {data?.ingredients
                                            .sort((a, b) => a.product.name.localeCompare(b.product.name))
                                            .map(item => {
                                                const adj = getAdj(item.product.id, adjustments);
                                                const isSelected = adj.quantity !== '';

                                                // Primary need (single unit) support
                                                const primaryNeed = item.primaryNeed;
                                                const neededText = item.totalNeededText;
                                                const onList = parseFloat(item.onList);
                                                const onListId = item.onListId;
                                                const onListUnit = item.onListUnit; // From backend

                                                // Default unit suggestion:
                                                // If on list, MUST use list unit.
                                                // Else use item/product unit.
                                                const defaultUnit = onList > 0 && onListUnit
                                                    ? onListUnit
                                                    : (item.unit || item.product.unit || 'Stück');

                                                const isLockedUnit = onList > 0;

                                                return (
                                                    <div key={item.product.id} className={cn(
                                                        "flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-center p-3 rounded-xl border border-border transition-all",
                                                        isSelected ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-card"
                                                    )}>
                                                        {/* Name & Source Details */}
                                                        <div className="w-full md:col-span-4 min-w-0 flex justify-between items-start md:block">
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-foreground truncate text-sm md:text-base">{item.product.name}</div>
                                                                <div className="text-xs text-muted-foreground truncate">{item.product.Store?.name}</div>
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap gap-1 justify-end md:justify-start">
                                                                {item.sources.slice(0, 2).map((s, i) => (
                                                                    <span key={i} className="inline-block px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground truncate max-w-[100px]" title={s.recipe}>
                                                                        {s.recipe}
                                                                    </span>
                                                                ))}
                                                                {item.sources.length > 2 && <span className="text-[10px] text-muted-foreground">+{item.sources.length - 2}</span>}
                                                            </div>
                                                        </div>

                                                        <div className="w-full flex md:hidden justify-between items-center bg-muted/20 p-2 rounded-lg text-xs">
                                                            <span>Benötigt: <span className="font-mono font-bold">{neededText}</span></span>
                                                            {onList > 0 && <span className="text-teal-600 font-bold flex items-center gap-1"><Check size={12} /> {onList} {onListUnit || item.product.unit}</span>}
                                                        </div>

                                                        {/* Needed (Desktop) */}
                                                        <div className="hidden md:flex col-span-3 text-center flex-col items-center justify-center">
                                                            <span className="font-mono font-medium text-sm bg-muted/30 px-2 py-1 rounded-lg">
                                                                {neededText}
                                                            </span>
                                                        </div>

                                                        {/* On List (Desktop) */}
                                                        <div className="hidden md:flex col-span-2 text-center items-center justify-center gap-2">
                                                            {onList > 0 ? (
                                                                <>
                                                                    <span className="font-mono font-bold text-teal-600 flex items-center gap-1 text-xs">
                                                                        <Check size={14} /> {onList} {onListUnit || item.product.unit}
                                                                    </span>
                                                                    {onListId && (
                                                                        <button
                                                                            onClick={() => handleDeleteItem(onListId)}
                                                                            className="text-muted-foreground hover:text-destructive p-1 rounded-full transition-colors"
                                                                            title="Von Liste entfernen"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-muted-foreground/30">-</span>
                                                            )}
                                                        </div>

                                                        {/* Action */}
                                                        <div className="w-full md:col-span-3 flex flex-wrap md:flex-nowrap items-center gap-2 justify-end mt-2 md:mt-0">
                                                            {/* Quick Add: Only if NOT on list already */}
                                                            {!isLockedUnit && !isSelected && (
                                                                <>
                                                                    {primaryNeed && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary whitespace-nowrap"
                                                                            onClick={() => handleQuickAdd(item.product.id, primaryNeed.amount, primaryNeed.unit)}
                                                                            title="Benötigte Menge übernehmen"
                                                                        >
                                                                            <Plus size={14} /> {primaryNeed.amount} {primaryNeed.unit}
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary whitespace-nowrap"
                                                                        onClick={() => handleQuickAdd(item.product.id, 1, defaultUnit)}
                                                                        title={`1 ${defaultUnit} hinzufügen`}
                                                                    >
                                                                        <Plus size={14} /> 1 {defaultUnit}
                                                                    </Button>
                                                                </>
                                                            )}

                                                            <div className={cn("flex items-center gap-1 transition-all", (isSelected || isLockedUnit) ? "opacity-100" : "opacity-50 hover:opacity-100")}>
                                                                <Input
                                                                    type="number"
                                                                    className={cn(
                                                                        "h-8 w-16 text-center font-bold px-1 transition-all",
                                                                        isSelected ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                                                                    )}
                                                                    value={adj.quantity}
                                                                    placeholder={isLockedUnit ? "+0" : "0"}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        handleManualChange(item.product.id, 'quantity', val);
                                                                        // Ensure unit is set
                                                                        if (!adj.unit) handleManualChange(item.product.id, 'unit', defaultUnit);
                                                                    }}
                                                                />
                                                                <UnitCombobox
                                                                    value={adj.unit || ''}
                                                                    onChange={(val) => handleManualChange(item.product.id, 'unit', val)}
                                                                    suggestions={availableUnits}
                                                                    disabled={isLockedUnit}
                                                                    className={cn("w-20", (isSelected || isLockedUnit) ? "opacity-100" : "opacity-0")}
                                                                />

                                                                {isSelected && (
                                                                    <button
                                                                        onClick={() => clearAdjustment(item.product.id)}
                                                                        className="text-muted-foreground hover:text-destructive shrink-0"
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-card flex flex-col-reverse md:flex-row justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} className="w-full md:w-auto">Abbrechen</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || Object.keys(adjustments).length === 0}
                            className="w-full md:w-auto px-4 md:px-8 shadow-lg shadow-primary/20"
                        >
                            {saving ? 'Speichert...' : `Hinzufügen (${Object.keys(adjustments).length})`}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
