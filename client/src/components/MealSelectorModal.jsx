import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChefHat, CarFront, Minus, Plus, ChevronLeft, Check } from 'lucide-react';
import { Input } from './Input';
import api from '../lib/axios';
import { getImageUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export default function MealSelectorModal({ isOpen, onClose, onSelect, initialDate, initialType }) {
    const { user } = useAuth();
    useLockBodyScroll(isOpen);
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState([]);
    const [manualEntry, setManualEntry] = useState('');
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [portions, setPortions] = useState(2);

    useEffect(() => {
        if (isOpen) {
            const isTutorial = sessionStorage.getItem('activeTutorialChapter') === 'menueplan';
            api.get(isTutorial ? '/recipes?tutorial=true' : '/recipes').then(res => setRecipes(res.data));
            setSearchTerm('');
            setManualEntry('');
            setSelectedCategory('All');
            setSelectedRecipe(null);
        }
    }, [isOpen]);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const categories = ['All', ...new Set(recipes.map(r => r.category).filter(Boolean))].sort();

    const filteredRecipes = recipes.filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualEntry.trim()) {
            onSelect({ description: manualEntry });
            onClose();
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden relative z-10"
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-2">
                                {selectedRecipe && (
                                    <button onClick={() => setSelectedRecipe(null)} className="p-1 -ml-2 hover:bg-muted rounded-full transition-colors">
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                <div>
                                    <h3 className="text-lg font-bebas tracking-wide">
                                        {selectedRecipe ? 'Portionen anpassen' : 'Mahlzeit wählen'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground capitalize">{initialType} • {new Date(initialDate).toLocaleDateString('de-DE', { weekday: 'long' })}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {selectedRecipe ? (
                                <div className="space-y-6 py-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                                        <div className="w-20 h-20 rounded-2xl bg-muted-foreground/10 flex items-center justify-center overflow-hidden shadow-lg border border-border shrink-0">
                                            {selectedRecipe.image_url ? (
                                                <img src={getImageUrl(selectedRecipe.image_url)} className="w-full h-full object-cover" />
                                            ) : (
                                                <ChefHat size={32} className="text-muted-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg leading-tight">{selectedRecipe.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">{selectedRecipe.category}</p>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-3xl border border-border">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block text-center mb-3">Portionen</span>
                                        <div className="flex items-center justify-center gap-6">
                                            <button
                                                onClick={() => setPortions(Math.max(1, portions - 1))}
                                                className="w-12 h-12 flex items-center justify-center bg-card rounded-2xl shadow-sm text-foreground hover:bg-primary/20 hover:text-primary transition-colors border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <Minus size={20} />
                                            </button>
                                            <span className="w-12 text-center font-black text-3xl">{portions}</span>
                                            <button
                                                onClick={() => setPortions(portions + 1)}
                                                className="w-12 h-12 flex items-center justify-center bg-card rounded-2xl shadow-sm text-foreground hover:bg-primary/20 hover:text-primary transition-colors border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            onSelect({ RecipeId: selectedRecipe.id, description: selectedRecipe.title, portions: portions }); // Pass ID for backend, desc for UI, portions
                                            onClose();
                                        }}
                                        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                    >
                                        <Check size={20} />
                                        Bestätigen
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Manual Entry Form */}
                                    <form id="tutorial-manual-entry" onSubmit={handleManualSubmit} className="space-y-3">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Manuelle Eingabe (z.B. Pizza bestellen)"
                                                value={manualEntry}
                                                onChange={e => setManualEntry(e.target.value)}
                                                className="h-10 text-sm"
                                            />
                                            <button type="submit" disabled={!manualEntry.trim()} className="bg-primary text-primary-foreground px-4 rounded-xl font-bold text-sm disabled:opacity-50 transition-opacity">
                                                OK
                                            </button>
                                        </div>

                                        {/* Eating Out Option - Compact */}
                                        <button
                                            type="button"
                                            id="placeholder-eating-out"
                                            onClick={() => {
                                                const note = manualEntry.trim() || 'Restaurant';
                                                onSelect({ description: note, is_eating_out: true });
                                                onClose();
                                            }}
                                            className="text-xs font-medium text-orange-600 flex items-center gap-1.5 hover:text-orange-700 transition-colors ml-1"
                                        >
                                            <CarFront size={14} />
                                            <span>Als "Auswärts essen" markieren</span>
                                        </button>
                                    </form>

                                    {user?.onboardingPreferences?.recipes !== false && (
                                        <>
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <span className="w-full border-t border-border" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase">
                                                    <span className="bg-card px-2 text-muted-foreground">Oder Rezept wählen</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                    <Input
                                                        placeholder="Rezept suchen..."
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                        className="pl-9 h-10 text-sm"
                                                    />
                                                </div>
                                                <select
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                    className="h-10 px-2 bg-muted/50 border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[100px]"
                                                >
                                                    {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'Alle' : cat}</option>)}
                                                </select>
                                            </div>

                                            <div id="tutorial-recipe-list" className="max-h-60 overflow-y-auto space-y-2">
                                                {filteredRecipes.map(recipe => (
                                                    <button
                                                        key={recipe.id}
                                                        onClick={() => {
                                                            setSelectedRecipe(recipe);
                                                            setPortions(recipe.servings || 2);
                                                        }}
                                                        className="w-full text-left p-3 rounded-xl hover:bg-muted flex items-center gap-3 transition-colors group"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {recipe.image_url ? (
                                                                <img src={getImageUrl(recipe.image_url)} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ChefHat size={20} className="text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm group-hover:text-primary transition-colors">{recipe.title}</div>
                                                            <div className="text-xs text-muted-foreground">{recipe.category}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
