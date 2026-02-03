import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Tag, Scale, Factory, AlertCircle, CheckCircle2, Loader2, Save, ChevronRight, ArrowRight } from 'lucide-react';
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
            category: products.filter(p => !p.category).length,
            manufacturer: products.filter(p => !p.ManufacturerId && !p.Manufacturer).length,
            unit: products.length // Unit cleanup considers all products
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

    // Handle default selections when tab changes
    useEffect(() => {
        if (!isOpen || step !== 'selection') return;

        const newSelected = new Set();
        if (selectedType === 'unit') {
            // Default: All deselected for unit
        } else {
            // Default: All selected for category and manufacturer
            filteredProducts.forEach(p => newSelected.add(p.id));
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
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set());
        } else {
            const newSelected = new Set();
            filteredProducts.forEach(p => newSelected.add(p.id));
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
                            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-background/50 backdrop-blur">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                                            {step === 'loading' ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                                        </div>
                                        AI Cleanup Assistant
                                    </h2>
                                    <p className="text-muted-foreground mt-1 ml-1">
                                        {step === 'selection' && "Optimieren Sie Ihre Produktdatenbank automatisch mit KI."}
                                        {step === 'loading' && "Die KI analysiert Ihre Produkte..."}
                                        {step === 'review' && "Überprüfen Sie die Vorschläge, bevor Sie sie übernehmen."}
                                    </p>
                                </div>
                                <button onClick={onClose} disabled={step === 'loading'} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Main Content Layout */}
                            <div className="flex-1 flex overflow-hidden relative">
                                {step === 'loading' && (
                                    <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                                        <Loader2 className="animate-spin text-primary" size={48} />
                                        <p className="text-lg font-medium text-muted-foreground animate-pulse">Analysiere Daten mit KI...</p>
                                    </div>
                                )}

                                {/* Sidebar / Tabs */}
                                <div className={cn("w-72 bg-muted/30 border-r border-border p-4 flex flex-col gap-3 overflow-y-auto shrink-0 transition-opacity", step !== 'selection' && "opacity-50 pointer-events-none")}>
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 mb-2">Bereinigen</div>
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setSelectedType(tab.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl text-left transition-all border",
                                                selectedType === tab.id
                                                    ? `bg-background shadow-md border-border ring-1 ring-primary/20`
                                                    : "hover:bg-background/50 border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-lg shrink-0", tab.bg, tab.color)}>
                                                <tab.icon size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold">{tab.label}</div>
                                                <div className="text-xs opacity-70 mt-0.5">{tab.count} Produkte betroffen</div>
                                            </div>
                                            {selectedType === tab.id && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 flex flex-col bg-background/50">
                                    {step === 'selection' ? (
                                        <>
                                            <div className="p-4 border-b border-border flex items-center justify-between bg-background/50 sticky top-0 z-10 backdrop-blur-sm">
                                                <h3 className="font-bold text-lg flex items-center gap-2">
                                                    {tabs.find(t => t.id === selectedType)?.label}
                                                    <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
                                                        {selectedIds.size} / {filteredProducts.length} ausgewählt
                                                    </span>
                                                </h3>
                                                {filteredProducts.length > 0 && (
                                                    <button
                                                        onClick={toggleAll}
                                                        className="text-sm font-medium text-primary hover:underline"
                                                    >
                                                        {selectedIds.size === filteredProducts.length ? 'Keine auswählen' : 'Alle auswählen'}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-4">
                                                {filteredProducts.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                        {filteredProducts.map(product => {
                                                            const isSelected = selectedIds.has(product.id);
                                                            return (
                                                                <div
                                                                    key={product.id}
                                                                    onClick={() => toggleSelection(product.id)}
                                                                    className={cn(
                                                                        "p-3 rounded-xl border transition-all flex items-start justify-between group cursor-pointer",
                                                                        isSelected
                                                                            ? "bg-primary/5 border-primary/40 shadow-sm"
                                                                            : "bg-card border-border hover:border-primary/20 hover:bg-muted/50"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className={cn(
                                                                            "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                                                            isSelected
                                                                                ? "bg-primary border-primary text-primary-foreground"
                                                                                : "border-muted-foreground/30 bg-background"
                                                                        )}>
                                                                            {isSelected && <CheckCircle2 size={14} />}
                                                                        </div>
                                                                        <div>
                                                                            <div className={cn("font-medium transition-colors", isSelected ? "text-primary" : "text-foreground")}>
                                                                                {product.name}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                                                                {selectedType !== 'unit' && <AlertCircle size={12} className="text-amber-500" />}
                                                                                {selectedType === 'category' ? 'Keine Kategorie' :
                                                                                    selectedType === 'manufacturer' ? 'Kein Hersteller' :
                                                                                        `Aktuell: ${product.unit}`}
                                                                            </div>
                                                                        </div>
                                                                    </div>
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
