import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Tag, Scale, Factory, AlertCircle, CheckCircle2, Loader2, Save, ChevronRight, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';
import { Input } from './Input';
import api from '../lib/axios';

export default function AiCleanupModal({ isOpen, onClose, products = [], onRefresh }) {
    const [selectedType, setSelectedType] = useState('category'); // 'category', 'manufacturer', 'unit'
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [step, setStep] = useState('selection'); // 'selection', 'loading', 'review'
    const [results, setResults] = useState([]); // [{ id, name, original, suggestion, accepted: true, value: '' }]
    const [saving, setSaving] = useState(false);
    const [showHidden, setShowHidden] = useState(false);

    const handleToggleHidden = async (productId) => {
        try {
            // Optimistic Update can be tricky with parent state props.
            // Ideally we call API then refresh. But for speed we might want to update local "products" clone?
            // Since "products" prop comes from parent, robust way is to trigger parent refresh.
            // But we can also force a re-render or update a local cache of hidden states if we had one.
            // For now: Call API then onRefresh (which refetches all products).
            const { data } = await api.post('/ai/cleanup/toggle-hidden', { productId, context: selectedType });
            // Trigger refresh to get updated product list with new hidden status
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
            alert('Fehler beim Ändern des Status');
        }
    };

    // Reset state on close or open
    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setResults([]);
            setSaving(false);
        }
    }, [isOpen]);

    const stats = useMemo(() => {
        return {
            category: products.filter(p => !p.category && !p.HiddenCleanups?.some(h => h.context === 'category')).length,
            manufacturer: products.filter(p => (!p.ManufacturerId && !p.Manufacturer) && !p.HiddenCleanups?.some(h => h.context === 'manufacturer')).length,
            // For unit, usually we check everyone. If hidden for unit, exclude.
            unit: products.filter(p => !p.HiddenCleanups?.some(h => h.context === 'unit')).length
        };
    }, [products]);

    const filteredProducts = useMemo(() => {
        switch (selectedType) {
            case 'category':
                return products.filter(p => !p.category);
            case 'manufacturer':
                return products.filter(p => !p.ManufacturerId && !p.Manufacturer);
            case 'unit':
                return products; // All products for unit cleanup
            default:
                return [];
        }
    }, [products, selectedType]);

    // Helper to check if product is hidden in current context
    const isProductHidden = (p) => p.HiddenCleanups?.some(h => h.context === selectedType);

    // Handle default selections when tab changes
    useEffect(() => {
        if (!isOpen || step !== 'selection') return;

        const newSelected = new Set();
        if (selectedType === 'unit') {
            // Default: All deselected for unit
        } else {
            // Default: All selected for category and manufacturer, EXCEPT hidden ones
            filteredProducts.forEach(p => {
                if (!isProductHidden(p)) {
                    newSelected.add(p.id);
                }
            });
        }
        setSelectedIds(newSelected);
    }, [selectedType, filteredProducts, isOpen, step]);

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        // Count selectable products (not hidden)
        const selectable = filteredProducts.filter(p => !isProductHidden(p));
        const allSelectableSelected = selectable.every(p => selectedIds.has(p.id));

        if (allSelectableSelected && selectable.length > 0) {
            // Deselect all
            setSelectedIds(new Set());
        } else {
            // Select all NOT HIDDEN
            const newSelected = new Set();
            selectable.forEach(p => newSelected.add(p.id));
            setSelectedIds(newSelected);
        }
    };

    const handleStartCleanup = async () => {
        setStep('loading');
        try {
            const productsToClean = filteredProducts
                .filter(p => selectedIds.has(p.id))
                .map(p => ({ id: p.id, name: p.name }));

            const { data } = await api.post('/ai/cleanup', {
                type: selectedType,
                products: productsToClean
            });

            // Format results for review
            const formattedResults = data.map(r => ({
                id: r.id,
                name: r.name,
                suggestion: r.category || r.unit || (r.manufacturers ? r.manufacturers[0] : ''),
                options: r.manufacturers || [], // For manufacturer dropdown
                unitAmount: r.amount || 1, // For unit
                value: r.category || r.unit || (r.manufacturers ? r.manufacturers[0] : ''),
                accepted: true,
                isCustom: false
            }));

            setResults(formattedResults);
            setStep('review');
        } catch (err) {
            console.error(err);
            alert('Fehler bei der AI-Anfrage: ' + (err.response?.data?.error || err.message));
            setStep('selection');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = results
                .filter(r => r.accepted)
                .map(r => {
                    if (selectedType === 'category') return { id: r.id, category: r.value };
                    if (selectedType === 'unit') return { id: r.id, unit: r.value };
                    return { id: r.id, manufacturerName: r.value };
                });

            // Execute updates in parallel or batch
            for (const update of updates) {
                if (selectedType === 'manufacturer') {
                    // Find or create manufacturer
                    try {
                        const mRes = await api.get('/manufacturers');
                        const existing = mRes.data.find(m => m.name.toLowerCase() === update.manufacturerName.toLowerCase());
                        let manufId = null;
                        if (existing) manufId = existing.id;
                        else {
                            const newMan = await api.post('/manufacturers', { name: update.manufacturerName });
                            manufId = newMan.data.id;
                        }
                        await api.put(`/products/${update.id}`, { ManufacturerId: manufId });
                    } catch (e) { console.error(e); }
                } else {
                    await api.put(`/products/${update.id}`, update);
                }
            }

            onRefresh && onRefresh();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'category', label: 'Fehlende Kategorien', icon: Tag, count: stats.category, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'manufacturer', label: 'Fehlende Hersteller', icon: Factory, count: stats.manufacturer, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { id: 'unit', label: 'Einheiten normalisieren', icon: Scale, count: stats.unit, color: 'text-green-500', bg: 'bg-green-500/10' },
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={step === 'loading' ? undefined : onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-5xl h-[85vh] relative z-10 flex flex-col pointer-events-auto"
                    >
                        <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-2xl bg-card">
                            {/* Header */}
                            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between shrink-0 bg-background/50 backdrop-blur">
                                <div>
                                    <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2 md:gap-3">
                                        <div className="p-1.5 md:p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                                            {step === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} className="md:w-6 md:h-6" />}
                                        </div>
                                        AI Cleanup
                                    </h2>
                                </div>
                                <button onClick={onClose} disabled={step === 'loading'} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Main Content Layout */}
                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
                                {step === 'loading' && (
                                    <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                                        <Loader2 className="animate-spin text-primary" size={48} />
                                        <p className="text-lg font-medium text-muted-foreground animate-pulse">Analysiere Daten...</p>
                                    </div>
                                )}

                                {/* Sidebar / Tabs */}
                                <div className={cn(
                                    "w-full md:w-72 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-2 md:p-4 grid grid-cols-3 md:flex md:flex-col gap-2 md:gap-3 shrink-0 transition-opacity",
                                    step !== 'selection' && "opacity-50 pointer-events-none"
                                )}>
                                    <div className="hidden md:block text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 mb-2">Bereinigen</div>
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setSelectedType(tab.id)}
                                            className={cn(
                                                "flex flex-col md:flex-row items-center md:gap-3 p-2 md:p-4 rounded-xl text-center md:text-left transition-all border",
                                                selectedType === tab.id
                                                    ? `bg-background shadow-md border-border ring-1 ring-primary/20`
                                                    : "hover:bg-background/50 border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn("p-1.5 md:p-2 rounded-lg shrink-0 mb-1 md:mb-0", tab.bg, tab.color)}>
                                                <tab.icon size={16} className="md:w-5 md:h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col items-center md:items-start">
                                                <div className="text-xs md:text-sm font-semibold leading-tight">{tab.label.split(' ')[1] || tab.label}</div>
                                                <div className="hidden md:block text-xs opacity-70 mt-0.5 whitespace-nowrap">{tab.count} Produkte</div>
                                                <div className="md:hidden text-[10px] opacity-70">{tab.count}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 flex flex-col bg-background/50 min-h-0 overflow-x-hidden">
                                    {step === 'selection' ? (
                                        <>
                                            <div className="p-3 md:p-4 border-b border-border flex items-center justify-between bg-background/50 sticky top-0 z-10 backdrop-blur-sm shrink-0">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                        {selectedIds.size} / {filteredProducts.filter(p => !p.isHidden).length}
                                                    </span>
                                                    <button
                                                        onClick={toggleAll}
                                                        className="text-xs md:text-sm font-medium text-primary hover:underline whitespace-nowrap truncate"
                                                    >
                                                        {selectedIds.size === filteredProducts.length && selectedIds.size > 0 ? 'Keine' : 'Alle'}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setShowHidden(!showHidden)}
                                                        className={cn("h-8 px-2 gap-1.5", showHidden ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                                    >
                                                        {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                                        <span className="text-xs">{showHidden ? 'Verstecken' : 'Zeigen'}</span>
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-4 min-h-0">
                                                {filteredProducts.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                        {filteredProducts.map(product => {
                                                            const isSelected = selectedIds.has(product.id);
                                                            const isHidden = product.HiddenCleanups?.some(h => h.context === selectedType);

                                                            if (!showHidden && isHidden) return null;

                                                            return (
                                                                <div
                                                                    key={product.id}
                                                                    className={cn(
                                                                        "p-3 rounded-xl border transition-all flex items-start justify-between group relative overflow-hidden",
                                                                        isSelected
                                                                            ? "bg-primary/5 border-primary/40 shadow-sm"
                                                                            : "bg-card border-border hover:border-primary/20 hover:bg-muted/50",
                                                                        isHidden && "opacity-60 bg-muted/50 grayscale shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border-transparent"
                                                                    )}
                                                                >
                                                                    {/* Click target for selection */}
                                                                    <div
                                                                        className="absolute inset-0 z-0"
                                                                        onClick={() => toggleSelection(product.id)}
                                                                    />

                                                                    <div className="flex items-start gap-3 relative z-10 pointer-events-none">
                                                                        <div className={cn(
                                                                            "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                                                            isSelected
                                                                                ? "bg-primary border-primary text-primary-foreground"
                                                                                : "border-muted-foreground/30 bg-background"
                                                                        )}>
                                                                            {isSelected && <CheckCircle2 size={14} />}
                                                                        </div>
                                                                        <div>
                                                                            <div className={cn("font-medium transition-colors line-clamp-1", isSelected ? "text-primary" : "text-foreground")}>
                                                                                {product.name}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                                                                {selectedType !== 'unit' && <AlertCircle size={12} className="text-amber-500" />}
                                                                                {selectedType === 'category' ? 'Keine Kategorie' :
                                                                                    selectedType === 'manufacturer' ? 'Kein Hersteller' :
                                                                                        `Aktuell: ${product.unit || 'Keine Einheit'}`}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Hide Toggle Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleToggleHidden(product.id);
                                                                        }}
                                                                        className={cn(
                                                                            "absolute top-1 right-1 z-30 p-2 rounded-lg hover:bg-muted/80 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100",
                                                                            isHidden ? "text-primary bg-primary/10" : "text-muted-foreground"
                                                                        )}
                                                                        title={isHidden ? "Wieder einblenden" : "Ausblenden"}
                                                                    >
                                                                        {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                                                        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
                                                            <CheckCircle2 size={32} />
                                                        </div>
                                                        <h4 className="text-xl font-semibold text-foreground mb-2">Alles sauber!</h4>
                                                        <p>Für diesen Bereich wurden keine unvollständigen Produkte gefunden.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        /* Review Step */
                                        <>
                                            <div className="p-4 border-b border-border flex items-center justify-between bg-background/50 sticky top-0 z-10 backdrop-blur-sm">
                                                <h3 className="font-bold text-lg flex items-center gap-2">Vorschläge überprüfen</h3>
                                                <div className="text-sm text-muted-foreground">{results.filter(r => r.accepted).length} Änderungen übernehmen</div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {results.map((result, idx) => (
                                                        <div key={result.id} className={cn("p-4 rounded-xl border bg-card transition-all flex items-center gap-4", !result.accepted && "opacity-50 grayscale")}>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-muted-foreground mb-1">Produkt</div>
                                                                <div className="font-bold truncate">{result.name}</div>
                                                            </div>
                                                            <ArrowRight className="text-muted-foreground shrink-0" size={16} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-muted-foreground mb-1">Vorschlag ({selectedType})</div>
                                                                {selectedType === 'manufacturer' && result.options?.length > 0 && !result.isCustom ? (
                                                                    <select
                                                                        value={result.value}
                                                                        onChange={(e) => {
                                                                            const newRes = [...results];
                                                                            if (e.target.value === '___OTHER___') {
                                                                                newRes[idx].isCustom = true;
                                                                                newRes[idx].value = '';
                                                                            } else {
                                                                                newRes[idx].value = e.target.value;
                                                                            }
                                                                            newRes[idx].accepted = true;
                                                                            setResults(newRes);
                                                                        }}
                                                                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm"
                                                                    >
                                                                        {result.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                        <option value="___OTHER___">(Anderer...)</option>
                                                                    </select>
                                                                ) : (
                                                                    <div className="flex gap-2 w-full">
                                                                        <Input
                                                                            value={result.value}
                                                                            onChange={(e) => {
                                                                                const newRes = [...results];
                                                                                newRes[idx].value = e.target.value;
                                                                                newRes[idx].accepted = true;
                                                                                setResults(newRes);
                                                                            }}
                                                                            className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-medium"
                                                                            placeholder={result.isCustom ? "Hersteller eingeben..." : ""}
                                                                            autoFocus={result.isCustom}
                                                                        />
                                                                        {selectedType === 'manufacturer' && result.isCustom && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => {
                                                                                    const newRes = [...results];
                                                                                    newRes[idx].isCustom = false;
                                                                                    newRes[idx].value = result.options[0] || '';
                                                                                    setResults(newRes);
                                                                                }}
                                                                                title="Zurück zur Auswahl"
                                                                            >
                                                                                <X size={16} />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    onClick={() => {
                                                                        const newRes = [...results];
                                                                        newRes[idx].accepted = !newRes[idx].accepted;
                                                                        setResults(newRes);
                                                                    }}
                                                                    className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", result.accepted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                                                                >
                                                                    <CheckCircle2 size={20} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={saving}
                                    className="h-12 px-6"
                                >
                                    {step === 'review' ? 'Abbrechen' : 'Schließen'}
                                </Button>
                                {step === 'selection' && (
                                    <Button
                                        onClick={handleStartCleanup}
                                        disabled={filteredProducts.length === 0 || selectedIds.size === 0}
                                        className="h-12 px-8 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                                    >
                                        <Sparkles size={18} />
                                        AI Cleanup Starten ({selectedIds.size})
                                    </Button>
                                )}
                                {step === 'review' && (
                                    <Button onClick={handleSave} disabled={saving || results.filter(r => r.accepted).length === 0} className="h-12 px-8 gap-2 bg-primary text-primary-foreground">
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        {saving ? 'Speichere...' : `Änderungen übernehmen (${results.filter(r => r.accepted).length})`}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
