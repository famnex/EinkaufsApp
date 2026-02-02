import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, Check, AlertCircle, Loader2, Tag } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import axios from 'axios';
import { cn } from '../lib/utils';

export default function AiImportModal({ isOpen, onClose, onSave }) {
    const [step, setStep] = useState('input'); // input, processing, review
    const [inputText, setInputText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [products, setProducts] = useState([]);
    const [mappings, setMappings] = useState({}); // { index: { type: 'existing'|'new', productId: ?, newName: ? } }
    const [creating, setCreating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            setStep('input');
            setInputText('');
            setParsedData(null);
            setMappings({});
        }
    }, [isOpen]);

    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/products');
            setProducts(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAnalyze = async () => {
        if (!inputText.trim()) return;
        setStep('processing');
        try {
            const { data } = await axios.post('http://localhost:5000/api/ai/parse', { input: inputText });

            // Smart Matching Strategy using AI provided search terms
            const newMappings = {};

            data.ingredients.forEach((ing, idx) => {
                let match = null;

                // 1. Direct Name Match (Case insensitive)
                match = products.find(p => p.name.toLowerCase() === ing.name.toLowerCase());

                // 2. Alternative Names Match (was Search Terms)
                if (!match && ing.alternative_names && Array.isArray(ing.alternative_names)) {
                    for (const term of ing.alternative_names) {
                        const termLower = term.toLowerCase();
                        match = products.find(p => p.name.toLowerCase() === termLower);
                        if (match) break;
                    }
                }

                if (match) {
                    newMappings[idx] = { type: 'existing', productId: match.id };
                } else {
                    newMappings[idx] = { type: 'new', newName: ing.name };
                }
            });

            setParsedData(data);
            setMappings(newMappings);
            setStep('review');
        } catch (err) {
            console.error(err);
            alert('Fehler bei der AI-Analyse: ' + (err.response?.data?.error || err.message));
            setStep('input');
        }
    };

    const handleMapChange = (idx, type, value) => {
        setMappings(prev => ({
            ...prev,
            [idx]: type === 'existing'
                ? { type: 'existing', productId: parseInt(value) }
                : { type: 'new', newName: value }
        }));
    };

    const handleSave = async () => {
        setCreating(true);
        try {
            // 1. Create Recipe
            const recipePayload = {
                title: parsedData.title,
                description: parsedData.description,
                image_url: parsedData.image_url || '',
                category: parsedData.category || 'Imported', // Use parsedData.category here
                prep_time: parsedData.prep_time || 0,
                duration: parsedData.total_time || 0,
                servings: parsedData.servings || 4,
                instructions: parsedData.steps || [],
                tags: parsedData.tags || []
            };

            const { data: recipe } = await axios.post('http://localhost:5000/api/recipes', recipePayload);

            // 2. Process Ingredients
            for (let i = 0; i < parsedData.ingredients.length; i++) {
                const rawIng = parsedData.ingredients[i];
                const mapping = mappings[i];
                let productId;

                if (mapping.type === 'existing') {
                    productId = mapping.productId;
                } else {
                    // Create new Product
                    const { data: newProd } = await axios.post('http://localhost:5000/api/products', {
                        name: mapping.newName,
                        unit: rawIng.unit || 'Stück'
                    });
                    productId = newProd.id;
                }

                // Link to Recipe
                await axios.post(`http://localhost:5000/api/recipes/${recipe.id}/ingredients`, {
                    ProductId: productId,
                    quantity: rawIng.amount || 1,
                    unit: rawIng.unit || 'Stück'
                });
            }

            onSave();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Fehler beim Speichern des Rezepts');
        } finally {
            setCreating(false);
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
                    className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bebas tracking-wide">AI Rezept Assistent</h2>
                                <p className="text-sm text-muted-foreground font-medium">Importiere Rezepte aus Text oder Links</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {step === 'input' && (
                            <div className="space-y-4">
                                <p className="text-muted-foreground">Füge den Rezepttext oder eine URL hier ein. Die KI wird versuchen, Zutaten und Schritte zu extrahieren.</p>
                                <textarea
                                    className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none font-medium"
                                    placeholder="Hier Rezept einfügen..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handleAnalyze} className="h-12 px-8 text-lg gap-2 shadow-lg shadow-primary/20">
                                        <Sparkles size={18} />
                                        Analysieren
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                <Loader2 size={48} className="text-primary animate-spin" />
                                <p className="text-lg font-bold text-foreground">Analysiere Rezept...</p>
                                <p className="text-sm text-muted-foreground">Dies kann einen Moment dauern.</p>
                            </div>
                        )}

                        {step === 'review' && parsedData && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {/* Image & Basic Info */}
                                    <div className="bg-muted/30 p-4 rounded-2xl border border-border space-y-4">
                                        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center group">
                                            {parsedData.image_url ? (
                                                <img src={parsedData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                    <Sparkles size={32} className="opacity-20" />
                                                    <span className="text-xs">Kein Bild gefunden</span>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="gap-2 mt-2"
                                                        disabled={isGenerating}
                                                        onClick={async () => {
                                                            if (!confirm('Ein neues Bild mit AI generieren? (Kostenpflichtig)')) return;
                                                            setIsGenerating(true);
                                                            try {
                                                                const { data } = await axios.post('http://localhost:5000/api/ai/generate-image', { title: parsedData.title });
                                                                setParsedData(prev => ({ ...prev, image_url: data.url }));
                                                            } catch (err) {
                                                                alert('Fehler beim Generieren: ' + err.message);
                                                            } finally {
                                                                setIsGenerating(false);
                                                            }
                                                        }}
                                                    >
                                                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                        AI Bild Generieren
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="gap-2"
                                                    onClick={async () => {
                                                        if (!confirm('Ein neues Bild mit AI generieren? (Kostenpflichtig)')) return;
                                                        try {
                                                            const { data } = await axios.post('http://localhost:5000/api/ai/generate-image', { title: parsedData.title });
                                                            setParsedData(prev => ({ ...prev, image_url: data.url }));
                                                        } catch (err) {
                                                            alert('Fehler beim Generieren: ' + err.message);
                                                        }
                                                    }}
                                                >
                                                    <Sparkles size={14} /> AI Bild Generieren
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Portionen</label>
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm"
                                                    value={parsedData.servings || 4}
                                                    onChange={e => setParsedData(p => ({ ...p, servings: parseInt(e.target.value) || 4 }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Vorber. (Min)</label>
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm"
                                                    value={parsedData.prep_time || 0}
                                                    onChange={e => setParsedData(p => ({ ...p, prep_time: parseInt(e.target.value) || 0 }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Gesamt (Min)</label>
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm"
                                                    value={parsedData.total_time || 0}
                                                    onChange={e => setParsedData(p => ({ ...p, total_time: parseInt(e.target.value) || 0 }))}
                                                />
                                            </div>
                                        </div>

                                        <h3 className="font-bold text-xl">{parsedData.title}</h3>
                                        <p className="text-sm text-muted-foreground">{parsedData.description}</p>

                                        <h4 className="font-bold text-sm uppercase text-muted-foreground pt-2">Zubereitung</h4>
                                        <div className="space-y-2 pl-4 border-l-2 border-primary/20 max-h-64 overflow-y-auto custom-scrollbar">
                                            {parsedData.steps.map((step, i) => (
                                                <p key={i} className="text-sm"><span className="font-bold text-primary mr-2">{i + 1}.</span>{step}</p>
                                            ))}
                                        </div>

                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                                                    <Tag size={12} /> Tags
                                                </h4>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="+ Tag"
                                                        className="h-6 w-24 text-xs"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = e.currentTarget.value.trim();
                                                                if (val && (!parsedData.tags || !parsedData.tags.includes(val))) {
                                                                    setParsedData(p => ({ ...p, tags: [...(p.tags || []), val] }));
                                                                    e.currentTarget.value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {parsedData.tags?.map((tag, idx) => (
                                                    <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 group">
                                                        {tag}
                                                        <button
                                                            onClick={() => setParsedData(p => ({ ...p, tags: p.tags.filter((_, i) => i !== idx) }))}
                                                            className="hover:text-destructive transition-colors"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                                {(!parsedData.tags || parsedData.tags.length === 0) && (
                                                    <span className="text-xs text-muted-foreground italic">Keine Tags</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <Check size={20} className="text-primary" />
                                        Zutaten Zuordnung
                                    </h3>
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {parsedData.ingredients.map((ing, idx) => {
                                            const mapping = mappings[idx];
                                            return (
                                                <div key={idx} className="p-3 bg-card border border-border rounded-xl flex items-center gap-3 shadow-sm text-sm">
                                                    <div className="w-1/3 shrink-0">
                                                        <p className="font-bold truncate" title={ing.name}>{ing.name}</p>
                                                        <p className="text-xs text-muted-foreground">{ing.amount} {ing.unit}</p>
                                                    </div>
                                                    <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col gap-1">
                                                            <select
                                                                className="w-full text-xs bg-muted/50 border-none rounded-lg p-1.5 font-medium focus:ring-1 focus:ring-primary truncate"
                                                                value={mapping.type === 'existing' ? mapping.productId : 'new'}
                                                                onChange={(e) => {
                                                                    if (e.target.value === 'new') {
                                                                        handleMapChange(idx, 'new', ing.name);
                                                                    } else {
                                                                        handleMapChange(idx, 'existing', e.target.value);
                                                                    }
                                                                }}
                                                            >
                                                                <option value="new">Neu: {ing.name}</option>
                                                                <optgroup label="Vorhanden">
                                                                    {products
                                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                                        .map(p => (
                                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                                        ))}
                                                                </optgroup>
                                                            </select>
                                                            {mapping.type === 'new' && (
                                                                <input
                                                                    className="w-full text-xs bg-background border border-border rounded px-2 py-1"
                                                                    value={mapping.newName}
                                                                    onChange={(e) => handleMapChange(idx, 'new', e.target.value)}
                                                                    placeholder="Neuer Name"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {step === 'review' && (
                        <div className="p-6 border-t border-border bg-card/80 backdrop-blur-md flex justify-end gap-3 rounded-b-3xl">
                            <Button variant="outline" onClick={() => setStep('input')} disabled={creating} className="h-12 px-6">
                                Zurück
                            </Button>
                            <Button onClick={handleSave} disabled={creating} className="h-12 px-8 shadow-lg shadow-primary/20">
                                {creating ? <Loader2 className="animate-spin" /> : 'Rezept Importieren'}
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
