import { useState, useEffect } from 'react';
import api from '../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ChefHat, Clock, Users, Sparkles, MoreHorizontal, Share2, Calendar } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { useEditMode } from '../contexts/EditModeContext';
import RecipeModal from '../components/RecipeModal';
import AiImportModal from '../components/AiImportModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import CookingMode from '../components/CookingMode';
import ScheduleModal from '../components/ScheduleModal';
import { cn, getImageUrl } from '../lib/utils';

import { useLocation } from 'react-router-dom';

export default function Recipes() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const { editMode, setEditMode } = useEditMode();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    const [cookingRecipe, setCookingRecipe] = useState(null);
    const [schedulingRecipe, setSchedulingRecipe] = useState(null);

    // Track which menu is open (by recipe ID)
    const [openMenuId, setOpenMenuId] = useState(null);

    // Close menu on outside click
    useEffect(() => {
        const closeMenu = () => setOpenMenuId(null);
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);

    useEffect(() => {
        fetchRecipes();
    }, []);

    // Handle deep linking / navigation state
    useEffect(() => {
        if (!loading && recipes.length > 0 && location.state?.openRecipeId) {
            const target = recipes.find(r => r.id === location.state.openRecipeId);
            if (target) {
                if (location.state.startCooking) {
                    setCookingRecipe(target);
                } else {
                    setSelectedRecipe(target);
                    setIsModalOpen(true);
                }
                // Clear state to prevent reopening on generic re-renders?
                // Actually keep it, but maybe replace history to clean it up.
                window.history.replaceState({}, document.title);
            }
        }
    }, [loading, recipes, location.state]);

    useEffect(() => {
        if (editMode === 'create') {
            setIsModalOpen(true);
            setSelectedRecipe(null);
        }
    }, [editMode]);

    const fetchRecipes = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/recipes');
            setRecipes(data);
        } catch (err) {
            console.error('Failed to fetch recipes', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        if (editMode === 'create') {
            setEditMode('view');
        }
    };

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState(null);
    const [deleteUsage, setDeleteUsage] = useState(null);

    const handleDelete = async (id, title) => {
        try {
            // Check usage
            const { data: usage } = await api.get(`/recipes/${id}/usage`);
            setRecipeToDelete({ id, title });
            setDeleteUsage(usage);
            setDeleteModalOpen(true);
        } catch (err) {
            console.error('Usage check failed', err);
            // Fallback if check fails
            if (confirm(`Löschen fehlgeschlagen beim Prüfen der Verwendung. Trotzdem löschen?`)) {
                confirmDeleteActual({ id }); // Direct delete bypass
            }
        }
    };

    const confirmDelete = async () => {
        if (!recipeToDelete) return;
        confirmDeleteActual(recipeToDelete);
    };

    const confirmDeleteActual = async (recipe) => {
        try {
            const token = localStorage.getItem('token');
            await api.delete(`/recipes/${recipe.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchRecipes();
            setDeleteModalOpen(false);
            setRecipeToDelete(null);
        } catch (err) {
            console.error('Delete failed', err);
            alert('Fehler beim Löschen: ' + (err.response?.data?.error || err.message));
        }
    };

    const [selectedCategory, setSelectedCategory] = useState('All');
    const categories = ['All', ...new Set(recipes.map(r => r.category).filter(Boolean))].sort();

    const filteredRecipes = recipes.filter(r => {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch =
            r.title.toLowerCase().includes(lowerSearch) ||
            r.category?.toLowerCase().includes(lowerSearch) ||
            r.Tags?.some(t => t.name.toLowerCase().includes(lowerSearch)) ||
            r.RecipeIngredients?.some(ri => ri.Product?.name.toLowerCase().includes(lowerSearch));

        const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            <div className="flex gap-2 w-full">
                {/* Search Field */}
                <div
                    className={cn(
                        "relative transition-all duration-300 ease-in-out overflow-hidden md:flex-1",
                        mobileCategoryOpen ? "w-12 bg-muted rounded-xl cursor-pointer" : "flex-1"
                    )}
                    onClick={() => setMobileCategoryOpen(false)}
                >
                    <Search
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-300",
                            mobileCategoryOpen ? "left-1/2 -translate-x-1/2" : "left-4"
                        )}
                        size={20}
                    />
                    <Input
                        placeholder="Rezept suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setMobileCategoryOpen(false)}
                        className={cn(
                            "pl-12 h-12 bg-card border-border shadow-sm transition-opacity duration-300",
                            mobileCategoryOpen ? "opacity-0 pointer-events-none" : "opacity-100"
                        )}
                    />
                </div>

                {/* Category Dropdown */}
                <div className={cn(
                    "relative transition-all duration-300 ease-in-out md:w-auto md:flex-none",
                    mobileCategoryOpen ? "flex-1" : "w-12"
                )}>
                    {/* Collapsed Icon (Mobile) */}
                    <div className={cn(
                        "absolute inset-0 flex items-center justify-center bg-card border border-border rounded-xl shadow-sm pointer-events-none transition-opacity duration-300 md:hidden",
                        mobileCategoryOpen ? "opacity-0" : "opacity-100"
                    )}>
                        <ChefHat size={20} className="text-muted-foreground" />
                    </div>

                    {/* Desktop Icon (Left Side) */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none text-muted-foreground">
                        <ChefHat size={20} />
                    </div>

                    <select
                        value={selectedCategory}
                        onFocus={() => setMobileCategoryOpen(true)}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            e.target.blur();
                            setMobileCategoryOpen(false);
                        }}
                        className={cn(
                            "h-12 w-full bg-card border border-border rounded-xl shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none px-4 transition-all duration-300 md:pl-12",
                            !mobileCategoryOpen ? "opacity-0 md:opacity-100 pl-4 text-transparent md:text-foreground" : "opacity-100"
                        )}
                    >
                        {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'Alle Kategorien' : cat}</option>)}
                    </select>

                    {/* Chevron for expanded state */}
                    <div className={cn(
                        "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none md:block",
                        mobileCategoryOpen ? "block" : "hidden"
                    )}>
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-muted-foreground" />
                    </div>
                </div>

                <div className="h-12 w-px bg-border mx-2 hidden md:block" />

                <Button
                    onClick={() => setIsAiModalOpen(true)}
                    className="h-12 px-3 md:px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 shrink-0"
                >
                    <Sparkles size={18} className="md:mr-2" />
                    <span className="hidden md:inline">AI Assistant</span>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredRecipes.map((recipe, index) => (
                        <motion.div
                            key={recipe.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => {
                                if (editMode === 'delete') {
                                    handleDelete(recipe.id, recipe.title);
                                } else if (editMode === 'edit') {
                                    setSelectedRecipe(recipe);
                                    setIsModalOpen(true);
                                } else {
                                    setCookingRecipe(recipe);
                                }
                            }}
                            className={`cursor-pointer group relative ${editMode === 'delete' ? 'ring-2 ring-destructive ring-offset-2 rounded-3xl' : ''}`}
                        >
                            <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 border-border bg-card flex flex-col">
                                <div className="aspect-video relative bg-muted shrink-0">
                                    {recipe.image_url ? (
                                        <img
                                            src={getImageUrl(recipe.image_url)}
                                            alt={recipe.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 max-h-[230px]"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                                            <ChefHat size={48} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                                    {/* Action Menu Trigger - Prevent card click propagation */}
                                    <div
                                        className="absolute top-2 right-2 z-20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Toggle this menu
                                            setOpenMenuId(openMenuId === recipe.id ? null : recipe.id);
                                        }}
                                    >
                                        <div className="relative">
                                            <button
                                                className={cn(
                                                    "p-2 rounded-full backdrop-blur-sm text-white transition-all duration-200",
                                                    openMenuId === recipe.id ? "bg-black/60" : "bg-black/20 hover:bg-black/40"
                                                )}
                                            >
                                                <MoreHorizontal size={20} />
                                            </button>

                                            {/* Menu Dropdown */}
                                            <AnimatePresence>
                                                {openMenuId === recipe.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        transition={{ duration: 0.1 }}
                                                        className="absolute right-0 top-full mt-2 w-48 py-1 rounded-xl bg-popover/95 backdrop-blur-xl border border-white/10 shadow-xl z-30 overflow-hidden"
                                                    >
                                                        <button
                                                            className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const link = `${window.location.origin}/shared/recipe/${recipe.id}`;
                                                                navigator.clipboard.writeText(link)
                                                                    .then(() => {
                                                                        alert('Link in die Zwischenablage kopiert!');
                                                                        setOpenMenuId(null);
                                                                    })
                                                                    .catch(err => console.error('Copy failed', err));
                                                            }}
                                                        >
                                                            <Share2 size={16} />
                                                            Teilen
                                                        </button>
                                                        <button
                                                            className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSchedulingRecipe(recipe);
                                                                setOpenMenuId(null);
                                                            }}
                                                        >
                                                            <Calendar size={16} />
                                                            Einplanen
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-4 left-4 right-4">
                                        <h3 className="text-xl font-bold text-white line-clamp-1">{recipe.title}</h3>
                                        <p className="text-white/80 text-sm">{recipe.category || 'Allgemein'}</p>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col justify-between flex-1 gap-4">
                                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                                        <div className="flex items-center gap-1">
                                            <Clock size={16} />
                                            <span>{(recipe.prep_time || 0) + (recipe.duration || 0)} min</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users size={16} />
                                            <span>{recipe.servings} Port.</span>
                                        </div>
                                    </div>

                                    {recipe.Tags && recipe.Tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                                            {recipe.Tags.map(tag => (
                                                <span
                                                    key={tag.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSearchTerm(tag.name);
                                                    }}
                                                    className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] uppercase font-bold rounded-full hover:bg-primary/20 transition-colors z-10"
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="aspect-video bg-muted rounded-3xl animate-pulse" />)}
                </div>
            )}

            {!loading && filteredRecipes.length === 0 && (
                <div className="text-center py-20 text-muted-foreground italic">
                    Keine Rezepte gefunden.
                </div>
            )}

            <RecipeModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                recipe={selectedRecipe}
                onSave={fetchRecipes}
            />
            <AiImportModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onSave={fetchRecipes}
            />
            {cookingRecipe && (
                <CookingMode
                    recipe={cookingRecipe}
                    onClose={() => setCookingRecipe(null)}
                />
            )}

            <ScheduleModal
                isOpen={!!schedulingRecipe}
                onClose={() => setSchedulingRecipe(null)}
                recipe={schedulingRecipe}
            />

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                recipe={recipeToDelete}
                usage={deleteUsage}
            />
        </div>
    );
}
