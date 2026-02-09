import { useState, useEffect, useMemo } from 'react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChefHat, Clock, Users, Filter, X, UtensilsCrossed, ArrowRight, ChevronDown, ChevronUp, Moon, Sun, Dices, Eye } from 'lucide-react';
import axios from 'axios';
import { cn, getImageUrl } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import SlotMachineModal from '../components/SlotMachineModal';
import { Button } from '../components/Button';
import SharedNotFound from '../components/SharedNotFound';

export default function SharedCookbook() {
    const navigate = useNavigate();
    const { sharingKey } = useParams();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cookbookInfo, setCookbookInfo] = useState({ title: 'MEIN KOCHBUCH', image: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Alle');
    const [selectedTags, setSelectedTags] = useState([]);
    const [categories, setCategories] = useState(['Alle']);
    const [allTags, setAllTags] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false); // Mobile filter toggle
    const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);

    // Determine API URL
    const baseURL = import.meta.env.BASE_URL === '/'
        ? '/api'
        : `${import.meta.env.BASE_URL}api`.replace('//', '/');
    const API_URL = import.meta.env.VITE_API_URL || baseURL;

    const [availableProducts, setAvailableProducts] = useState([]);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                const url = `${API_URL.replace(/\/$/, '')}/recipes/public/${sharingKey}`;
                const { data } = await axios.get(url);
                setRecipes(data.recipes);
                setCookbookInfo({
                    title: data.cookbookTitle || 'MEIN KOCHBUCH',
                    image: data.cookbookImage
                });

                // Extract Categories
                const cats = ['Alle', ...new Set(data.recipes.map(r => r.category).filter(Boolean))].sort();
                setCategories(cats);

                // Extract Tags
                const tags = new Set();
                data.recipes.forEach(r => {
                    r.Tags?.forEach(t => tags.add(t.name));
                });
                setAllTags(Array.from(tags).sort());

            } catch (err) {
                console.error("Failed to load recipes", err);
                if (err.response?.status === 403 || err.response?.status === 404) {
                    setError('Ungültiger Link');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchRecipes();
    }, [sharingKey, API_URL]);

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredRecipes = useMemo(() => {
        return recipes.filter(recipe => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = recipe.title.toLowerCase().includes(searchLower) ||
                recipe.category?.toLowerCase().includes(searchLower);

            // Category
            const matchesCategory = selectedCategory === 'Alle' || recipe.category === selectedCategory;

            // Tags (AND logic: recipe must have ALL selected tags)
            const matchesTags = selectedTags.length === 0 ||
                selectedTags.every(t => recipe.Tags?.some(rt => rt.name === t));

            return matchesSearch && matchesCategory && matchesTags;
        });
    }, [recipes, searchTerm, selectedCategory, selectedTags]);

    const { visibleItems: renderedRecipes, observerTarget } = useInfiniteScroll(filteredRecipes, 16);

    const renderImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;
        const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
        const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        return `${cleanBase}/${cleanUrl}`;
    };

    if (error) {
        return <SharedNotFound />;
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
            {/* Hero Header */}
            <div className={cn(
                "relative overflow-hidden mb-8 transition-all duration-700",
                isDark ? "bg-zinc-950" : "bg-indigo-950",
                "text-white"
            )}>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 to-blue-900/40 z-0 pointer-events-none" />
                <div
                    className="absolute inset-0 opacity-10 z-0 pointer-events-none"
                    style={{ backgroundImage: `url(${import.meta.env.BASE_URL}pattern.svg)` }}
                />

                {/* Theme Toggle */}
                <div className="absolute top-4 right-4 z-20">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-white"
                        title={isDark ? "Hell-Modus" : "Dunkel-Modus"}
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-8 md:py-20 relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 rounded-full shadow-2xl"
                    >
                        {cookbookInfo.image ? (
                            <img
                                src={renderImageUrl(cookbookInfo.image)}
                                alt={cookbookInfo.title}
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/20 object-cover"
                            />
                        ) : (
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center">
                                <ChefHat className="text-white/60" size={64} />
                            </div>
                        )}
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-7xl font-black tracking-tighter mb-2 text-white drop-shadow-xl uppercase"
                    >
                        {cookbookInfo.title}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-base md:text-xl text-gray-300 max-w-2xl mb-8 font-medium"
                    >
                        Entdecke {recipes.length} leckere Rezepte, kuratiert und gesammelt für jeden Geschmack.
                    </motion.p>

                    {/* Search Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="w-full max-w-xl relative group flex flex-col gap-4 items-center"
                    >

                        <div className="relative w-full flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-3 shadow-2xl transition-all focus-within:bg-white/20 focus-within:border-primary/50">
                            <Search className="text-gray-400 mr-3" size={20} />
                            <input
                                type="text"
                                placeholder="Was möchtest du heute kochen?"
                                className="bg-transparent border-none outline-none text-white text-base md:text-lg w-full placeholder:text-gray-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-white/10 rounded-full">
                                    <X size={16} className="text-gray-300" />
                                </button>
                            )}
                        </div>

                        <Button
                            onClick={() => setIsSlotMachineOpen(true)}
                            className="h-12 px-8 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-500 hover:via-orange-600 hover:to-rose-600 text-white border-none shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Dices size={18} />
                            Zufalls-Roulette
                        </Button>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-20">
                {/* Filters */}
                {/* Filters - Accordion on Mobile */}
                <div className="mb-6 space-y-4">
                    <button
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        className="md:hidden flex items-center justify-between w-full p-4 bg-card border border-border rounded-xl font-bold"
                    >
                        <div className="flex items-center gap-2">
                            <Filter size={18} />
                            <span>Kategorien & Filter</span>
                        </div>
                        {filtersOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>

                    <div className={cn("space-y-6", filtersOpen ? "block" : "hidden md:block")}>
                        {/* Categories names */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={cn(
                                        "px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border",
                                        selectedCategory === cat
                                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105"
                                            : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Tags */}
                        {allTags.length > 0 && (
                            <div className="bg-card/50 rounded-2xl p-4 border border-border/50">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 font-bold">
                                    <Filter size={16} />
                                    <span>Filter nach Tags:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allTags.map(tag => {
                                        const isSelected = selectedTags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                onClick={() => toggleTag(tag)}
                                                className={cn(
                                                    "px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                                                    isSelected
                                                        ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                                                        : "bg-transparent border-transparent hover:bg-muted text-muted-foreground"
                                                )}
                                            >
                                                #{tag}
                                            </button>
                                        );
                                    })}
                                    {selectedTags.length > 0 && (
                                        <button
                                            onClick={() => setSelectedTags([])}
                                            className="px-3 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                                        >
                                            Filter zurücksetzen
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="aspect-[4/5] bg-muted/50 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredRecipes.length > 0 ? (
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        <AnimatePresence>
                            {renderedRecipes.map(recipe => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    key={recipe.id}
                                >
                                    <div
                                        className="group relative bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full flex flex-col"
                                        onClick={() => navigate(`/shared/${sharingKey}/recipe/${recipe.id}`)}
                                    >
                                        {/* Image */}
                                        <div className="aspect-[3/2] relative overflow-hidden">
                                            {recipe.image_url ? (
                                                <img
                                                    src={renderImageUrl(recipe.image_url)}
                                                    alt={recipe.title}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                                    <UtensilsCrossed size={48} className="text-muted-foreground/30" />
                                                </div>
                                            )}

                                            {/* Overlay Gradient */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                            {/* Top Badge */}
                                            <div className="absolute top-4 left-4">
                                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-white uppercase tracking-wider border border-white/10">
                                                    {recipe.category || 'Rezept'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-5 flex-1 flex flex-col relative">
                                            {/* Floating Time Badge (overlaps image) */}
                                            <div className="absolute -top-6 right-4 bg-card shadow-lg p-2 rounded-2xl flex flex-col items-center min-w-[3.5rem] border border-border">
                                                <span className="text-lg font-bold leading-none">{recipe.duration}</span>
                                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Min</span>
                                            </div>

                                            <h3 className="text-xl font-bold mb-2 line-clamp-2 mt-2 group-hover:text-primary transition-colors">
                                                {recipe.title}
                                            </h3>

                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {recipe.Tags?.map(tag => {
                                                    const isSelected = selectedTags.includes(tag.name);
                                                    return (
                                                        <button
                                                            key={tag.name}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTag(tag.name);
                                                            }}
                                                            className={cn(
                                                                "text-[10px] px-2 py-0.5 rounded transition-colors border",
                                                                isSelected
                                                                    ? "bg-secondary text-secondary-foreground border-secondary"
                                                                    : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                                                            )}
                                                        >
                                                            #{tag.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Users size={14} />
                                                    <span>{recipe.servings} Pers.</span>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                    <ArrowRight size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {/* Observer Target for Infinite Scroll */}
                        <div ref={observerTarget} className="h-4 w-full col-span-full" />
                    </motion.div>
                ) : (
                    <div className="py-20 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                            <Search size={32} className="text-muted-foreground" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Keine Rezepte gefunden</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Leider entsprechen keine Rezepte deinen Suchkriterien. Versuch es mit anderen Filtern oder Suchbegriffen.
                        </p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('Alle');
                                setSelectedTags([]);
                            }}
                            className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold hover:shadow-lg transition-all"
                        >
                            Alles anzeigen
                        </button>
                    </div>
                )}
            </div>
            <SlotMachineModal
                isOpen={isSlotMachineOpen}
                onClose={() => setIsSlotMachineOpen(false)}
                recipes={recipes}
                confirmLabel="REZEPT ANZEIGEN"
                ActionIcon={Eye}
                availableProducts={availableProducts}
                onSelect={(recipe) => {
                    navigate(`/shared/${sharingKey}/recipe/${recipe.id}`);
                    setIsSlotMachineOpen(false);
                }}
            />
        </div>
    );
}
