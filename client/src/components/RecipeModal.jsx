import { useState, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Clock, Users, ArrowRight, Wand2, Plus, Minus, Search, Trash2, Image as ImageIcon, Sparkles, Loader2, Tag, ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';
import { cn, getImageUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function RecipeModal({ isOpen, onClose, recipe, onSave }) {
    const [activeTab, setActiveTab] = useState(0); // 0: Basics, 1: Ingredients, 2: Steps, 3: AI
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);

    // Tab 1: Basics
    const [basics, setBasics] = useState({
        title: '',
        category: '',
        prep_time: '',
        duration: '',
        servings: 2,
        image: null,
        imagePreview: null,
        tags: [],
        imageSource: 'scraped'
    });

    // Tab 2: Ingredients
    const [ingredients, setIngredients] = useState([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [ingredientSuggestions, setIngredientSuggestions] = useState([]);
    const [deletedIngredients, setDeletedIngredients] = useState([]);

    // Tab 3: Steps
    const [steps, setSteps] = useState(['']);



    useLockBodyScroll(isOpen);

    useEffect(() => {
        if (isOpen) {
            api.get('/products').then(res => setProducts(res.data));

            if (recipe) {
                setLoading(true);
                api.get(`/recipes/${recipe.id}`)
                    .then(res => {
                        const fullRecipe = res.data;
                        setBasics({
                            title: fullRecipe.title,
                            category: fullRecipe.category,
                            prep_time: fullRecipe.prep_time,
                            duration: fullRecipe.duration,
                            servings: fullRecipe.servings,
                            image: null,
                            imagePreview: fullRecipe.image_url,
                            tags: fullRecipe.Tags ? fullRecipe.Tags.map(t => t.name) : [],
                            imageSource: fullRecipe.imageSource || 'scraped'
                        });

                        // Load ingredients
                        const apiIngredients = fullRecipe.RecipeIngredients?.map(ri => ({
                            id: ri.id,
                            ProductId: ri.ProductId,
                            name: ri.Product?.name,
                            quantity: ri.quantity,
                            unit: ri.unit || ri.Product?.unit
                        })) || [];
                        setIngredients(apiIngredients);

                        // Load steps
                        if (fullRecipe.instructions && Array.isArray(fullRecipe.instructions) && fullRecipe.instructions.length > 0) {
                            setSteps(fullRecipe.instructions);
                        } else {
                            setSteps(['']);
                        }
                    })
                    .catch(err => console.error(err))
                    .finally(() => setLoading(false));
            } else {
                resetForm();
            }
        }
    }, [isOpen, recipe]);

    // Reset deleted ingredients when opening/changing recipe
    useEffect(() => {
        if (isOpen) {
            setDeletedIngredients([]);
        }
    }, [isOpen, recipe]);

    const resetForm = () => {
        setActiveTab(0);
        setDeletedIngredients([]);
        setBasics({
            title: '',
            category: '',
            prep_time: 15,
            duration: 30,
            servings: 2,
            image: null,
            imagePreview: null,
            imagePreview: null,
            tags: [],
            imageSource: 'scraped'
        });
        setIngredients([]);
        setSteps(['']);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBasics({ ...basics, image: file, imageSource: 'upload' });
            const reader = new FileReader();
            reader.onloadend = () => {
                setBasics(prev => ({ ...prev, imagePreview: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleIngredientSearch = (val) => {
        setIngredientSearch(val);
        if (val.trim()) {
            const matches = products.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
            setIngredientSuggestions(matches);
        } else {
            setIngredientSuggestions([]);
        }
    };

    const addIngredient = (product) => {
        // Check if already added
        if (ingredients.some(i => i.ProductId === product.id)) return;

        setIngredients([...ingredients, {
            ProductId: product.id,
            name: product.name,
            quantity: 1,
            unit: product.unit
        }]);
        setIngredientSearch('');
        setIngredientSuggestions([]);
    };

    const removeIngredient = (index) => {
        const item = ingredients[index];
        if (item.id) {
            setDeletedIngredients([...deletedIngredients, item.id]);
        }
        const newIng = [...ingredients];
        newIng.splice(index, 1);
        setIngredients(newIng);
    };

    const updateIngredient = (index, field, value) => {
        const newIng = [...ingredients];
        newIng[index][field] = value;
        setIngredients(newIng);
    };

    const handleSave = async () => {
        setLoading(true);
        console.log('--- RECIPE MODAL SAVE START ---');
        console.log('Basics:', basics);
        console.log('Ingredients:', ingredients);
        console.log('Steps:', steps);

        try {
            const formData = new FormData();
            formData.append('title', basics.title);
            formData.append('category', basics.category);
            formData.append('prep_time', basics.prep_time);
            formData.append('duration', basics.duration);
            formData.append('servings', basics.servings);
            formData.append('instructions', JSON.stringify(steps.filter(s => s.trim())));

            formData.append('tags', JSON.stringify(basics.tags));
            formData.append('imageSource', basics.imageSource);

            if (basics.image) {
                console.log('Appending Image File:', basics.image.name);
                formData.append('image', basics.image);
            } else if (basics.imagePreview) {
                console.log('Appending Image URL:', basics.imagePreview);
                formData.append('image_url', basics.imagePreview);
            }

            console.log('Sending FormData...');

            let recipeId;
            if (recipe) {
                console.log('Updating existing recipe:', recipe.id);
                await api.put(`/recipes/${recipe.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                recipeId = recipe.id;
            } else {
                console.log('Creating new recipe');
                const { data } = await api.post('/recipes', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log('Created recipe ID:', data.id);
                recipeId = data.id;
            }

            // 1. Process deletions
            if (deletedIngredients.length > 0) {
                console.log('Processing deleted ingredients:', deletedIngredients);
                for (const delId of deletedIngredients) {
                    try {
                        await api.delete(`/recipes/${recipeId}/ingredients/${delId}`);
                    } catch (e) {
                        console.error('Failed to delete ingredient', delId, e);
                    }
                }
            }

            // 2. Additions/Updates
            console.log('Processing ingredients updates/additions...');
            for (const ing of ingredients) {
                if (!ing.id) { // New link
                    await api.post(`/recipes/${recipeId}/ingredients`, {
                        ProductId: ing.ProductId,
                        quantity: parseFloat(ing.quantity) || 0,
                        unit: ing.unit
                    });
                } else {
                    // Update existing
                    await api.put(`/recipes/${recipeId}/ingredients/${ing.id}`, {
                        quantity: parseFloat(ing.quantity) || 0,
                        unit: ing.unit
                    });
                }
            }

            console.log('--- RECIPE MODAL SAVE SUCCESS ---');
            onSave();
            onClose();
        } catch (err) {
            console.error('--- RECIPE MODAL SAVE ERROR ---', err);
            if (err.response) {
                console.error('Status:', err.response.status);
                console.error('Data:', err.response.data);
            }
            alert('Fehler beim Speichern: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 0, label: 'Basisdaten' },
        { id: 1, label: 'Zutaten' },
        { id: 2, label: 'Zubereitung' }
    ];

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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h2 className="text-2xl font-bebas tracking-wide text-foreground">
                                    {recipe ? 'Rezept bearbeiten' : 'Neues Rezept'}
                                </h2>
                                <p className="text-sm text-muted-foreground">{tabs[activeTab].label}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={24} className="text-muted-foreground" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 0 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="flex gap-6 flex-col md:flex-row">
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Titel</label>
                                                <Input value={basics.title} onChange={e => setBasics({ ...basics, title: e.target.value })} placeholder="z.B. Spaghetti Carbonara" autoFocus />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategorie</label>
                                                <Input value={basics.category} onChange={e => setBasics({ ...basics, category: e.target.value })} placeholder="z.B. Italienisch, Schnell..." />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1"><Tag size={12} /> Tags</label>
                                                <Input
                                                    placeholder="+ Tag (Enter)"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value.trim();
                                                            if (val && !basics.tags.includes(val)) {
                                                                setBasics(prev => ({ ...prev, tags: [...prev.tags, val] }));
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {basics.tags?.map((tag, idx) => (
                                                        <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                            {tag}
                                                            <button
                                                                onClick={() => setBasics(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }))}
                                                                className="hover:text-destructive transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1"><Clock size={12} /> Vorbereitung (Min)</label>
                                                    <Input type="number" value={basics.prep_time} onChange={e => setBasics({ ...basics, prep_time: e.target.value })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1"><Clock size={12} /> Zubereitung (Min)</label>
                                                    <Input type="number" value={basics.duration} onChange={e => setBasics({ ...basics, duration: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1"><Users size={12} /> Portionen</label>
                                                <Input type="number" value={basics.servings} onChange={e => setBasics({ ...basics, servings: e.target.value })} />
                                            </div>

                                        </div>
                                        <div className="w-full md:w-1/3">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Bild</label>

                                            {/* Image Preview Area */}
                                            <div className="aspect-[3/4] rounded-2xl bg-muted border-2 border-dashed border-border relative overflow-hidden group">
                                                {basics.imagePreview ? (
                                                    <img src={getImageUrl(basics.imagePreview)} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center pointer-events-none">
                                                        <ImageIcon size={48} className="opacity-50" />
                                                        <span className="text-sm font-medium">Kein Bild</span>
                                                    </div>
                                                )}

                                                {/* Image Source Badge - Visual Only */}
                                                {basics.imageSource && (
                                                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                                                        <div className={cn(
                                                            "px-2 py-1 rounded-lg text-white shadow-lg backdrop-blur-md border flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                                                            basics.imageSource === 'scraped' && "bg-red-500/80 border-red-400/30",
                                                            basics.imageSource === 'upload' && "bg-blue-500/80 border-blue-400/30",
                                                            basics.imageSource === 'ai' && "bg-purple-500/80 border-purple-400/30"
                                                        )}>
                                                            {basics.imageSource === 'scraped' && <ShieldAlert size={12} />}
                                                            {basics.imageSource === 'upload' && <ImageIcon size={12} />}
                                                            {basics.imageSource === 'ai' && <Sparkles size={12} />}
                                                            <span>
                                                                {basics.imageSource === 'scraped' && 'Web'}
                                                                {basics.imageSource === 'upload' && 'Upload'}
                                                                {basics.imageSource === 'ai' && 'AI'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Bar */}
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                {/* Upload Button */}
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        onChange={handleImageChange}
                                                        className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                                                        accept="image/*"
                                                    />
                                                    <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs">
                                                        <ImageIcon size={14} /> Upload
                                                    </Button>
                                                </div>

                                                {/* AI Button */}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full gap-2 text-xs"
                                                    disabled={loading}
                                                    onClick={async () => {
                                                        if (!basics.title) {
                                                            alert('Bitte erst einen Titel eingeben');
                                                            return;
                                                        }

                                                        // Decide between Variation (Img2Img) and New Generation (Txt2Img)
                                                        if (basics.imagePreview) {
                                                            if (!confirm('Eine Variation des aktuellen Bildes erstellen? (Kostenpflichtig)')) return;

                                                            try {
                                                                setLoading(true);
                                                                const { data } = await api.post('/ai/regenerate-image', {
                                                                    imageUrl: basics.imagePreview,
                                                                    title: basics.title
                                                                });
                                                                // Cache buster not strictly needed if filename changes, but good practice
                                                                setBasics(prev => ({ ...prev, imagePreview: data.url, image: null, imageSource: 'ai' }));
                                                            } catch (err) {
                                                                alert('Fehler: ' + err.message);
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        } else {
                                                            // New Generation
                                                            if (!confirm('Ein neues Bild für "' + basics.title + '" generieren? (Kostenpflichtig)')) return;

                                                            try {
                                                                setLoading(true);
                                                                const { data } = await api.post('/ai/generate-image', { title: basics.title });
                                                                setBasics(prev => ({ ...prev, imagePreview: data.url, image: null, imageSource: 'ai' }));
                                                            } catch (err) {
                                                                alert('Fehler: ' + err.message);
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                                    {basics.imagePreview ? 'Variante' : 'AI Neu'}
                                                </Button>

                                                {/* Delete Button */}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full gap-2 text-xs hover:text-destructive hover:border-destructive"
                                                    disabled={!basics.imagePreview}
                                                    onClick={() => {
                                                        if (confirm('Bild wirklich entfernen?')) {
                                                            setBasics(prev => ({ ...prev, imagePreview: null, image: null, imageSource: null }));
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={14} /> Weg
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 1 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                        <Input
                                            placeholder="Zutat suchen..."
                                            value={ingredientSearch}
                                            onChange={e => handleIngredientSearch(e.target.value)}
                                            className="pl-12"
                                        />
                                        {ingredientSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                                                {ingredientSuggestions.map(p => (
                                                    <button key={p.id} onClick={() => addIngredient(p)} className="w-full text-left p-3 hover:bg-muted flex justify-between items-center transition-colors">
                                                        <span className="font-medium">{p.name}</span>
                                                        <span className="text-xs text-muted-foreground">{p.category}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="grid grid-cols-12 gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground px-2">
                                            <div className="col-span-6">Zutat</div>
                                            <div className="col-span-3">Menge</div>
                                            <div className="col-span-2">Einh.</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                        {ingredients.map((ing, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded-xl">
                                                <div className="col-span-6 font-medium text-foreground">{ing.name}</div>
                                                <div className="col-span-3">
                                                    <Input
                                                        type="number"
                                                        value={ing.quantity}
                                                        onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                                                        className="h-8 text-sm bg-background"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        value={ing.unit || ''}
                                                        placeholder="Einh."
                                                        onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                                                        className="h-8 text-sm bg-background"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button onClick={() => removeIngredient(idx)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {ingredients.length === 0 && (
                                            <div className="text-center py-10 text-muted-foreground italic">Noch keine Zutaten.</div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 2 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="space-y-4">
                                        {steps.map((step, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-1">
                                                    {idx + 1}
                                                </div>
                                                <textarea
                                                    value={step}
                                                    onChange={e => {
                                                        const newSteps = [...steps];
                                                        newSteps[idx] = e.target.value;
                                                        setSteps(newSteps);
                                                    }}
                                                    placeholder={`Schritt ${idx + 1}...`}
                                                    className="flex-1 min-h-[80px] p-3 rounded-xl bg-muted/30 border border-transparent focus:bg-background focus:border-primary/20 transition-all resize-none outline-none"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newSteps = [...steps];
                                                        newSteps.splice(idx, 1);
                                                        setSteps(newSteps);
                                                    }}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive mt-1"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            onClick={() => setSteps([...steps, ''])}
                                            className="w-full border-dashed"
                                        >
                                            <Plus size={16} className="mr-2" /> Schritt hinzufügen
                                        </Button>
                                    </div>
                                </motion.div>
                            )}


                        </div>

                        {/* Footer (Tabs & Actions) */}
                        <div className="p-4 bg-background border-t border-border flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex bg-muted p-1 rounded-xl w-full md:w-auto">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                            activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <Button variant="ghost" onClick={onClose} className="flex-1 md:flex-none">Abbrechen</Button>
                                <Button onClick={handleSave} disabled={loading} className="flex-1 md:flex-none min-w-[120px]">
                                    {loading ? 'Speichert...' : 'Speichern'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
