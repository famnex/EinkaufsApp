import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChefHat } from 'lucide-react';
import { Input } from './Input';
import axios from 'axios';

export default function MealSelectorModal({ isOpen, onClose, onSelect, initialDate, initialType }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState([]);
    const [manualEntry, setManualEntry] = useState('');

    useEffect(() => {
        if (isOpen) {
            axios.get('http://localhost:5000/api/recipes').then(res => setRecipes(res.data));
            setSearchTerm('');
            setManualEntry('');
            setSelectedCategory('All');
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
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-lg font-bebas tracking-wide">Mahlzeit wählen</h3>
                                <p className="text-xs text-muted-foreground capitalize">{initialType} • {new Date(initialDate).toLocaleDateString('de-DE', { weekday: 'long' })}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Manual Entry */}
                            <form onSubmit={handleManualSubmit} className="flex gap-2">
                                <Input
                                    placeholder="Manuelle Eingabe (z.B. Pizza bestellen)"
                                    value={manualEntry}
                                    onChange={e => setManualEntry(e.target.value)}
                                />
                                <button type="submit" disabled={!manualEntry.trim()} className="bg-primary text-primary-foreground px-4 rounded-xl font-bold text-sm disabled:opacity-50">
                                    OK
                                </button>
                            </form>

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

                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {filteredRecipes.map(recipe => (
                                    <button
                                        key={recipe.id}
                                        onClick={() => {
                                            onSelect({ RecipeId: recipe.id, description: recipe.title }); // Pass ID for backend, desc for UI
                                            onClose();
                                        }}
                                        className="w-full text-left p-3 rounded-xl hover:bg-muted flex items-center gap-3 transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {recipe.image_url ? (
                                                <img src={`http://localhost:5000${recipe.image_url}`} className="w-full h-full object-cover" />
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
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
