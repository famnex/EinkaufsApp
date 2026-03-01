import { useState, useEffect, useMemo, useRef } from 'react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import api from '../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ChefHat, Clock, Users, Sparkles, MoreHorizontal, Share2, Calendar, Printer, ArrowLeft, ArrowRight, Dices, ShieldAlert, Edit, Heart, RefreshCw, Menu, ArrowUpDown, ChevronDown, Lock, Instagram, Copy, X, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { useEditMode } from '../contexts/EditModeContext';
import RecipeModal from '../components/RecipeModal';
import AiImportModal from '../components/AiImportModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import CookingMode from '../components/CookingMode';
import ScheduleModal from '../components/ScheduleModal';
import SlotMachineModal from '../components/SlotMachineModal';
import ShareConfirmationModal from '../components/ShareConfirmationModal';
import RecipeIntoleranceResolverModal from '../components/RecipeIntoleranceResolverModal';
import RecipeSubstitutionsModal from '../components/RecipeSubstitutionsModal';
import AiLockedModal from '../components/AiLockedModal';
import { cn, getImageUrl } from '../lib/utils';
import LoadingOverlay from '../components/LoadingOverlay';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Recipes() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [recipes, setRecipes] = useState([]);
    const [menus, setMenus] = useState([]);

    useEffect(() => {
        fetchRecipes();
        fetchMenus();
    }, []);

    const fetchMenus = async () => {
        try {
            const start = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data } = await api.get(`/menus?start=${start}&end=${end}`);
            setMenus(data);
        } catch (err) {
            console.error('Failed to fetch menus', err);
        }
    };

    const getRecipeStatus = (recipeId) => {
        const recipeMenus = menus.filter(m => m.RecipeId === recipeId);
        const today = new Date().toISOString().split('T')[0];

        const past = recipeMenus.filter(m => m.date < today).sort((a, b) => b.date.localeCompare(a.date));
        const future = recipeMenus.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));

        return {
            lastCooked: past.length > 0 ? new Date(past[0].date) : null,
            nextPlanned: future.length > 0 ? new Date(future[0].date) : null
        };
    };

    const [loading, setLoading] = useState(true);
    const [mobileActiveFilter, setMobileActiveFilter] = useState('search');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const { editMode, setEditMode } = useEditMode();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [initialModalTab, setInitialModalTab] = useState(0);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiLockedOpen, setIsAiLockedOpen] = useState(false);
    const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    const [cookingRecipe, setCookingRecipe] = useState(null);
    const [cookingConflicts, setCookingConflicts] = useState([]);
    const [schedulingRecipe, setSchedulingRecipe] = useState(null);
    const [resolvingRecipe, setResolvingRecipe] = useState(null);
    const [resolvingConflicts, setResolvingConflicts] = useState([]);
    const [substitutionsRecipe, setSubstitutionsRecipe] = useState(null);

    // Instagram Post Generation
    const [instaPostResult, setInstaPostResult] = useState(null);
    const [isInstaLoading, setIsInstaLoading] = useState(false);
    const [copiedInsta, setCopiedInsta] = useState(false);

    // Track which menu is open (by recipe ID)
    const [openMenuId, setOpenMenuId] = useState(null);

    // Close menu on outside click
    useEffect(() => {
        const closeMenu = () => {
            setOpenMenuId(null);
            setIsMobileMenuOpen(false);
        };
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);



    const deepLinkHandled = useRef(false);

    // Handle deep linking / navigation state
    useEffect(() => {
        if (!loading && recipes.length > 0 && location.state?.openRecipeId && !deepLinkHandled.current) {
            const target = recipes.find(r => r.id === location.state.openRecipeId);
            if (target) {
                deepLinkHandled.current = true;
                if (location.state.startCooking) {
                    handleOpenCookingMode(target);
                } else {
                    setSelectedRecipe(target);
                    setIsModalOpen(true);
                }
                // Clear state in history so refresh doesn't trigger it again
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
            // Phase 1: Basic Info
            const { data: basicData } = await api.get('/recipes?phase=basic');
            setRecipes(basicData);
            setLoading(false); // Tiles can be shown now

            // Phase 2: Images (Async)
            api.get('/recipes?phase=images').then(({ data: imageData }) => {
                setRecipes(prev => prev.map(r => {
                    const match = imageData.find(img => img.id === r.id);
                    return match ? { ...r, ...match } : r;
                }));
            }).catch(err => console.error('Failed to fetch recipe images', err));

            // Phase 3: Search Metadata (Async)
            api.get('/recipes?phase=search').then(({ data: searchData }) => {
                setRecipes(prev => prev.map(r => {
                    const match = searchData.find(s => s.id === r.id);
                    return match ? { ...r, ...match } : r;
                }));
            }).catch(err => console.error('Failed to fetch search metadata', err));

        } catch (err) {
            console.error('Failed to fetch recipes', err);
            setLoading(false);
        }
    };

    const handleGenerateInstaPost = async (recipe) => {
        try {
            setIsInstaLoading(true);
            setInstaPostResult(null);

            // 1. Get full recipe data (with ingredients and instructions)
            const { data: fullRecipe } = await api.get(`/recipes/${recipe.id}`);

            // 2. Format data for AI
            const ingredientsText = fullRecipe.RecipeIngredients?.map(ri =>
                `${ri.quantity || ''} ${ri.unit || ''} ${ri.Product?.name || ''}`.trim()
            ).join('\n') || 'Keine Zutaten angegeben.';

            const steps = typeof fullRecipe.instructions === 'string'
                ? JSON.parse(fullRecipe.instructions)
                : (fullRecipe.instructions || []);
            const instructionsText = steps.join('\n') || 'Keine Zubereitungsschritte angegeben.';

            // 2. Call AI endpoint
            const { data } = await api.post('/ai/insta-post', {
                title: fullRecipe.title,
                ingredients: ingredientsText,
                instructions: instructionsText
            });

            setInstaPostResult(data.post);
        } catch (err) {
            console.error('Failed to generate Insta post', err);
            alert('Fehler beim Generieren des Instagram Posts: ' + (err.response?.data?.error || err.message));
            setIsInstaLoading(false);
            setInstaPostResult(null);
        } finally {
            setIsInstaLoading(false);
        }
    };

    // Load full recipe data for cooking mode (includes ingredients)
    const handleOpenCookingMode = async (recipe) => {
        try {
            // Fetch full recipe details with ingredients
            const { data } = await api.get(`/recipes/${recipe.id}`);
            setCookingRecipe(data);

            // Fetch intolerance conflicts - filter out substituted products
            const substitutedProductIds = new Set(data.substitutions?.map(s => s.originalProductId) || []);
            const productIds = [...new Set(data.RecipeIngredients
                ?.map(ri => ri.ProductId)
                .filter(pid => pid && !substitutedProductIds.has(pid)) || [])];

            if (productIds.length > 0) {
                const hasSpecialTier = ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                    ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                    user?.tier?.includes('Admin') || user?.role === 'admin';
                if (!hasSpecialTier) {
                    setCookingConflicts([]);
                } else {
                    try {
                        const { data: conflictData } = await api.post('/intolerances/check', { productIds });
                        setCookingConflicts(conflictData);
                    } catch (err) {
                        console.error('Failed to check intolerances', err);
                        setCookingConflicts([]);
                    }
                }
            } else {
                setCookingConflicts([]);
            }
        } catch (err) {
            console.error('Failed to load recipe details', err);
            // Fallback to basic data if fetch fails
            setCookingRecipe(recipe);
            setCookingConflicts([]);
        }
    };

    const handlePlanClick = async (recipe) => {
        try {
            // Get full recipe to have ingredients and substitutions
            const { data: fullRecipe } = await api.get(`/recipes/${recipe.id}`);

            // Get IDs of products that AREN'T substituted yet
            const substitutedProductIds = new Set(fullRecipe.substitutions?.map(s => s.originalProductId) || []);
            const productIdsToCheck = fullRecipe.RecipeIngredients
                ?.map(ri => ri.ProductId)
                .filter(pid => pid && !substitutedProductIds.has(pid)) || [];

            if (productIdsToCheck.length > 0) {
                const hasSpecialTier = ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                    ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                    user?.tier?.includes('Admin') || user?.role === 'admin';
                if (hasSpecialTier) {
                    const { data: conflicts } = await api.post('/intolerances/check', { productIds: productIdsToCheck });
                    const severeConflicts = conflicts.filter(c => c.maxProbability >= 30);

                    if (severeConflicts.length > 0) {
                        setResolvingRecipe(fullRecipe);
                        setResolvingConflicts(severeConflicts);
                        return;
                    }
                }
            }

            setSchedulingRecipe(recipe);
        } catch (err) {
            console.error('Failed to prepare planning', err);
            setSchedulingRecipe(recipe);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRecipe(null);
        setInitialModalTab(0);
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

    const effectiveUserId = user?.householdId || user?.id;

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState('A-Z'); // 'A-Z', 'Meiste in Favoriten', 'Meiste Klicks', 'Am Meisten gekocht', 'Wenigste Zutaten', 'Schnellste Kochzeit'

    // Dynamically build favorite categories based on who in the household favorited what
    const favoriteCategories = useMemo(() => {
        const cats = ['Meine Favoriten']; // Always include own favorites as an option
        recipes.forEach(r => {
            if (r.favoritedBy) {
                r.favoritedBy.forEach(name => {
                    if (name !== user?.username) {
                        const catName = `Favoriten von ${name}`;
                        if (!cats.includes(catName)) {
                            cats.push(catName);
                        }
                    }
                });
            }
        });
        return cats.sort((a, b) => {
            if (a === 'Meine Favoriten') return -1;
            if (b === 'Meine Favoriten') return 1;
            return a.localeCompare(b);
        });
    }, [recipes, user?.username]);

    const availableCategories = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
    const categories = ['All', ...favoriteCategories, ...availableCategories, 'Ohne Bilder'];

    const filteredRecipes = useMemo(() => {
        return recipes.filter(r => {
            const lowerSearch = searchTerm.toLowerCase();
            const matchesSearch =
                r.title.toLowerCase().includes(lowerSearch) ||
                r.category?.toLowerCase().includes(lowerSearch) ||
                r.Tags?.some(t => t.name.toLowerCase().includes(lowerSearch)) ||
                r.RecipeIngredients?.some(ri => ri.Product?.name.toLowerCase().includes(lowerSearch));

            // Special category: 'Ohne Bilder' shows only recipes without images, special favorites logic
            let matchesCategory = false;
            if (selectedCategory === 'All') {
                matchesCategory = String(r.UserId) === String(effectiveUserId); // In "All", only show own recipes
            } else if (selectedCategory === 'Ohne Bilder') {
                matchesCategory = String(r.UserId) === String(effectiveUserId) && !r.image_url;
            } else if (selectedCategory === 'Meine Favoriten') {
                matchesCategory = r.isFavorite === true; // Show all favorites for ME
            } else if (selectedCategory.startsWith('Favoriten von ')) {
                const nameMatches = selectedCategory.replace('Favoriten von ', '');
                matchesCategory = r.favoritedBy && r.favoritedBy.includes(nameMatches);
            } else {
                matchesCategory = String(r.UserId) === String(effectiveUserId) && r.category === selectedCategory;
            }

            return matchesSearch && matchesCategory;
        }).sort((a, b) => {
            if (sortBy === 'A-Z') return a.title.localeCompare(b.title);
            if (sortBy === 'Am Meisten gekocht') return (b.cookCount || 0) - (a.cookCount || 0);
            if (sortBy === 'Meiste in Favoriten') return (b.favoritedBy?.length || 0) - (a.favoritedBy?.length || 0);
            if (sortBy === 'Meiste Klicks') return (b.clicks || 0) - (a.clicks || 0);
            if (sortBy === 'Wenigste Zutaten') return (a.RecipeIngredients?.length || 0) - (b.RecipeIngredients?.length || 0);
            if (sortBy === 'Schnellste Kochzeit') {
                const timeA = (a.prep_time || 0) + (a.duration || 0);
                const timeB = (b.prep_time || 0) + (b.duration || 0);
                // If both are 0, might leave as is or put at end, but basic sort is fine
                if (timeA === 0 && timeB === 0) return 0;
                if (timeA === 0) return 1;
                if (timeB === 0) return -1;
                return timeA - timeB;
            }
            return 0;
        });
    }, [recipes, searchTerm, selectedCategory, sortBy]);

    const { visibleItems: renderedRecipes, observerTarget } = useInfiniteScroll(filteredRecipes, 12);

    const [shareModalConfig, setShareModalConfig] = useState(null); // { title, text, url }
    const { setUser } = useAuth(); // Ensure we can update user state locally

    const executeShare = async (title, text, url) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url
                });
            } catch (err) {
                console.error('Error sharing', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${text}: ${url}`);
                alert('Link in die Zwischenablage kopiert!');
            } catch (err) {
                console.error('Copy failed', err);
                alert('Kopieren fehlgeschlagen');
            }
        }
    };

    const handleShareRequest = (title, text, url) => {
        if (user?.isPublicCookbook) {
            executeShare(title, text, url);
        } else {
            setShareModalConfig({ title, text, url });
        }
    };

    const handleConfirmShare = async () => {
        if (!shareModalConfig) return;

        try {
            // Enable public cookbook
            const { data } = await api.put('/auth/profile', { isPublicCookbook: true });

            // Update local state, taking backend's newly generated sharingKey
            if (user) {
                setUser({ ...user, ...data });
            }

            // Replace placeholder in URL with actual sharing key if necessary
            // Depending on how shareModalConfig.url is created, it might be stale. Let's fix it.
            const actualUrl = shareModalConfig.url.replace('/shared//', `/shared/${data.sharingKey}/`).replace('/shared/undefined/', `/shared/${data.sharingKey}/`);

            // Proceed with share
            executeShare(shareModalConfig.title, shareModalConfig.text, actualUrl);
        } catch (err) {
            console.error('Failed to enable public cookbook', err);
            alert('Fehler beim Aktivieren des öffentlichen Kochbuchs.');
        } finally {
            setShareModalConfig(null);
        }
    };

    const toggleFavorite = async (e, recipe) => {
        e.stopPropagation(); // prevent opening the recipe or other clicks
        try {
            const token = localStorage.getItem('token');
            const { data } = await api.post(`/recipes/${recipe.id}/favorite`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Update the specific recipe in state
            setRecipes(prev => prev.map(r => r.id === data.id ? { ...r, isFavorite: data.isFavorite } : r));
        } catch (err) {
            console.error('Failed to toggle favorite', err);
            alert('Fehler beim Speichern der Favoriten-Einstellung.');
        }
    };

    return (
        <LoadingOverlay isLoading={loading}>
            <div className="space-y-6">
                {/* ... (Search/Filter UI unchanged) ... */}
                <div className="flex gap-2 w-full">
                    {/* Search Field */}
                    <div
                        className={cn(
                            "relative transition-all duration-300 ease-in-out overflow-hidden md:flex-1",
                            mobileActiveFilter === 'search' ? "flex-1" : "w-12 bg-muted/50 md:bg-transparent rounded-xl cursor-pointer"
                        )}
                        onClick={() => setMobileActiveFilter('search')}
                    >
                        <Search
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-300",
                                mobileActiveFilter !== 'search' ? "left-1/2 -translate-x-1/2" : "left-4"
                            )}
                            size={20}
                        />
                        <Input
                            placeholder="Rezept suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setMobileActiveFilter('search')}
                            className={cn(
                                "pl-12 h-12 bg-card border-border shadow-sm transition-all duration-300",
                                mobileActiveFilter !== 'search' ? "opacity-0 pointer-events-none" : "opacity-100"
                            )}
                        />
                    </div>

                    {/* Category Dropdown */}
                    <div
                        className={cn(
                            "relative transition-all duration-300 ease-in-out md:w-64",
                            mobileActiveFilter === 'category' ? "flex-1" : "w-12 bg-muted/50 md:bg-transparent rounded-xl cursor-pointer"
                        )}
                        onClick={() => setMobileActiveFilter('category')}
                    >
                        {/* Collapsed Icon (Mobile) */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 md:hidden",
                            mobileActiveFilter === 'category' ? "opacity-0" : "opacity-100"
                        )}>
                            <ChefHat size={20} className="text-muted-foreground" />
                        </div>

                        {/* Desktop Icon (Left Side) */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none text-muted-foreground">
                            <ChefHat size={20} />
                        </div>

                        <select
                            value={selectedCategory}
                            onFocus={() => setMobileActiveFilter('category')}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                e.target.blur();
                            }}
                            className={cn(
                                "h-12 w-full bg-card border border-border rounded-xl shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none px-4 transition-all duration-300 md:pl-12",
                                mobileActiveFilter !== 'category' ? "opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto" : "opacity-100"
                            )}
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'Alle Kategorien' : cat}</option>)}
                        </select>

                        {/* Chevron for expanded state */}
                        <div className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none md:block",
                            mobileActiveFilter === 'category' ? "block" : "hidden"
                        )}>
                            <ChevronDown size={16} className="text-muted-foreground" />
                        </div>
                    </div>

                    {/* Sorting Dropdown */}
                    <div
                        className={cn(
                            "relative transition-all duration-300 ease-in-out md:w-64",
                            mobileActiveFilter === 'sort' ? "flex-1" : "w-12 bg-muted/50 md:bg-transparent rounded-xl cursor-pointer"
                        )}
                        onClick={() => setMobileActiveFilter('sort')}
                    >
                        {/* Collapsed Icon (Mobile) */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 md:hidden",
                            mobileActiveFilter === 'sort' ? "opacity-0" : "opacity-100"
                        )}>
                            <ArrowUpDown size={20} className="text-muted-foreground" />
                        </div>

                        {/* Desktop Icon (Left Side) - Hidden if too narrow but usually fine */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none text-muted-foreground">
                            <ArrowUpDown size={18} />
                        </div>

                        <select
                            value={sortBy}
                            onFocus={() => setMobileActiveFilter('sort')}
                            onChange={(e) => {
                                setSortBy(e.target.value);
                                e.target.blur();
                            }}
                            className={cn(
                                "h-12 w-full bg-card border border-border rounded-xl shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none px-4 transition-all duration-300 md:pl-12 pr-10",
                                mobileActiveFilter !== 'sort' ? "opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto" : "opacity-100"
                            )}
                        >
                            {['A-Z', 'Am Meisten gekocht', 'Meiste in Favoriten', 'Meiste Klicks', 'Wenigste Zutaten', 'Schnellste Kochzeit'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <div className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none md:block",
                            mobileActiveFilter === 'sort' ? "block" : "hidden"
                        )}>
                            <ChevronDown size={16} className="text-muted-foreground" />
                        </div>
                    </div>

                    <div className="h-12 w-px bg-border mx-1 hidden md:block" />

                    {/* Desktop Action Buttons */}
                    <div className="hidden md:flex gap-2">
                        <Button
                            onClick={() => {
                                handleShareRequest(
                                    'Mein Kochbuch',
                                    'Schau dir mein Kochbuch an!',
                                    `${window.location.origin}${import.meta.env.BASE_URL}shared/${user?.sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1")
                                );
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 bg-card border border-border text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <Share2 size={20} />
                        </Button>

                        <Button
                            onClick={() => setIsSlotMachineOpen(true)}
                            className="h-12 px-6 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-500 hover:via-orange-600 hover:to-rose-600 text-white border-none shadow-xl shadow-orange-500/20 active:scale-95 transition-all group overflow-hidden relative shrink-0"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                            <Dices size={24} className="w-[18px] h-[18px] mr-2 group-hover:rotate-180 transition-transform duration-500" />
                            <span className="font-bold">Zufalls-Roulette</span>
                        </Button>

                        {user?.tier !== 'Plastikgabel' ? (
                            <Button
                                onClick={() => setIsAiModalOpen(true)}
                                className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 shrink-0 select-none pb-safe-0"
                            >
                                <Sparkles size={18} className="mr-2" />
                                <span>AI Assistant</span>
                            </Button>
                        ) : (
                            <Button
                                onClick={() => setIsAiLockedOpen(true)}
                                className="h-12 px-6 bg-muted text-muted-foreground shadow-none shrink-0 select-none opacity-60 hover:opacity-80 transition-opacity relative"
                            >
                                <Sparkles size={18} className="mr-2 opacity-50" />
                                <span>AI Assistant</span>
                                <Lock size={13} className="absolute top-1 right-1 opacity-70" />
                            </Button>
                        )}
                    </div>

                    {/* Mobile Burger Menu */}
                    <div className="md:hidden relative">
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMobileMenuOpen(!isMobileMenuOpen);
                            }}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-12 w-12 bg-card border border-border transition-all duration-200",
                                isMobileMenuOpen ? "text-primary border-primary/50" : "text-muted-foreground"
                            )}
                        >
                            <Menu size={24} />
                        </Button>

                        <AnimatePresence>
                            {isMobileMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="absolute right-0 top-full mt-2 w-56 py-2 rounded-2xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl z-[100] overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {user?.tier !== 'Plastikgabel' ? (
                                        <button
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                            onClick={() => {
                                                setIsAiModalOpen(true);
                                                setIsMobileMenuOpen(false);
                                            }}
                                        >
                                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                                <Sparkles size={18} />
                                            </div>
                                            AI Assistant
                                        </button>
                                    ) : (
                                        <button
                                            className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors text-muted-foreground font-medium opacity-60 relative"
                                            onClick={() => {
                                                setIsAiLockedOpen(true);
                                                setIsMobileMenuOpen(false);
                                            }}
                                        >
                                            <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                                                <Sparkles size={18} />
                                            </div>
                                            AI Assistant
                                            <Lock size={13} className="ml-auto opacity-70" />
                                        </button>
                                    )}
                                    <button
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                        onClick={() => {
                                            setIsSlotMachineOpen(true);
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
                                            <Dices size={18} />
                                        </div>
                                        Zufalls-Rezept
                                    </button>
                                    <div className="h-px bg-border mx-2 my-1" />
                                    <button
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                        onClick={() => {
                                            handleShareRequest(
                                                'Mein Kochbuch',
                                                'Schau dir mein Kochbuch an!',
                                                `${window.location.origin}${import.meta.env.BASE_URL}shared/${user?.sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1")
                                            );
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <Share2 size={18} />
                                        </div>
                                        Kochbuch teilen
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <RecipeSubstitutionsModal
                    isOpen={!!substitutionsRecipe}
                    onClose={() => setSubstitutionsRecipe(null)}
                    recipeId={substitutionsRecipe?.id}
                    recipeTitle={substitutionsRecipe?.title}
                    onUpdate={fetchRecipes}
                />

                <SlotMachineModal
                    isOpen={isSlotMachineOpen}
                    onClose={() => setIsSlotMachineOpen(false)}
                    recipes={recipes}
                    onSelect={(recipe) => {
                        handlePlanClick(recipe);
                        setIsSlotMachineOpen(false);
                    }}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {renderedRecipes.map((recipe, index) => {
                            const status = getRecipeStatus(recipe.id);
                            return (
                                <motion.div
                                    key={recipe.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                                    onClick={() => {
                                        if (editMode === 'delete') {
                                            handleDelete(recipe.id, recipe.title);
                                        } else if (editMode === 'edit') {
                                            setSelectedRecipe(recipe);
                                            setIsModalOpen(true);
                                        } else {
                                            handleOpenCookingMode(recipe);
                                        }
                                    }}
                                    className={`cursor-pointer group relative ${editMode === 'delete' ? 'ring-2 ring-destructive ring-offset-2 rounded-3xl' : ''}`}
                                >
                                    <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 border-border bg-card flex flex-col">
                                        <div className="aspect-video relative bg-muted shrink-0">
                                            {recipe.image_url ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        src={getImageUrl(recipe.image_url)}
                                                        alt={recipe.title}
                                                        loading="lazy"
                                                        onLoad={(e) => {
                                                            e.target.classList.remove('opacity-0');
                                                            const spinner = e.target.nextSibling;
                                                            if (spinner && spinner.classList) spinner.classList.add('hidden');
                                                        }}
                                                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 max-h-[230px] opacity-0"
                                                    />
                                                    {/* Local Spinner while img is opacity-0 */}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse z-0">
                                                        <RefreshCw className="text-muted-foreground/20 animate-spin" size={32} />
                                                    </div>
                                                </div>
                                            ) : recipe.imageSource === 'none' ? (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                                                    <ChefHat size={48} />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                                    <RefreshCw className="text-muted-foreground/20 animate-spin" size={32} />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                                            {recipe.imageSource === 'scraped' && (
                                                <div className="absolute bottom-2 right-2 z-20 group/tooltip">
                                                    <div className="bg-red-500/90 backdrop-blur-md p-1.5 rounded-lg shadow-lg border border-red-400/30 text-white cursor-help">
                                                        <ShieldAlert size={16} />
                                                    </div>
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-xl shadow-xl border border-border opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                                        Achtung: Dieses Bild wird im Shared Modus nicht angezeigt (Urheberrecht unklar).
                                                    </div>
                                                </div>
                                            )}

                                            {recipe.hasSubstitutions && (
                                                <div className="absolute top-2 left-2 z-20">
                                                    <div className="bg-amber-500/90 backdrop-blur-md px-2 py-1 rounded-lg shadow-lg border border-amber-400/30 text-white flex items-center gap-1.5 pointer-events-none">
                                                        <RefreshCw size={12} className="animate-spin-slow" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Ersetzungen aktiv</span>
                                                    </div>
                                                </div>
                                            )}

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
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => toggleFavorite(e, recipe)}
                                                            className="absolute top-12 right-0 p-2 rounded-full backdrop-blur-sm bg-black/20 hover:bg-black/40 text-white transition-all duration-200 focus:outline-none"
                                                            title="Zu Favoriten hinzufügen/entfernen"
                                                        >
                                                            <Heart
                                                                size={20}
                                                                className={cn("transition-colors duration-300", recipe.isFavorite ? "fill-rose-500 text-rose-500" : "text-white")}
                                                            />
                                                        </button>
                                                    </div>

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
                                                                        const baseUrl = import.meta.env.BASE_URL;
                                                                        const link = `${window.location.origin}${baseUrl}shared/${user?.sharingKey}/recipe/${recipe.id}`.replace(/([^:]\/)\//g, "$1");

                                                                        handleShareRequest(
                                                                            recipe.title,
                                                                            `Schau mal, ich habe ein Rezept für dich: ${recipe.title}`,
                                                                            link
                                                                        );
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    <Share2 size={16} />
                                                                    Teilen
                                                                </button>
                                                                <button
                                                                    className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedRecipe(recipe);
                                                                        setIsModalOpen(true);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    <Edit size={16} />
                                                                    Bearbeiten
                                                                </button>
                                                                {recipe.hasSubstitutions && (
                                                                    <button
                                                                        className="w-full text-left px-4 py-3 text-sm text-amber-500 hover:bg-white/10 flex items-center gap-3 transition-colors font-bold"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSubstitutionsRecipe(recipe);
                                                                            setOpenMenuId(null);
                                                                        }}
                                                                    >
                                                                        <RefreshCw size={16} />
                                                                        Ersetzungen
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePlanClick(recipe);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    <Calendar size={16} />
                                                                    Einplanen
                                                                </button>
                                                                <button
                                                                    className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const baseUrl = import.meta.env.BASE_URL;
                                                                        const link = `${window.location.origin}${baseUrl}shared/${user?.sharingKey}/recipe/${recipe.id}`.replace(/([^:]\/)\/+/g, "$1");
                                                                        window.open(link, '_blank');
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    <Printer size={16} />
                                                                    Drucken
                                                                </button>
                                                                {user?.role === 'admin' && (
                                                                    <button
                                                                        className="w-full text-left px-4 py-3 text-sm text-pink-500 hover:bg-white/10 flex items-center gap-3 transition-colors font-bold"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleGenerateInstaPost(recipe);
                                                                            setOpenMenuId(null);
                                                                        }}
                                                                    >
                                                                        <Instagram size={16} />
                                                                        Instagram Post
                                                                    </button>
                                                                )}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                            {/* Recipe Status Badge (Future or Past) */}
                                            {status.nextPlanned ? (
                                                <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500/90 backdrop-blur-md text-white text-xs font-bold rounded-lg shadow-sm border border-emerald-400/20 z-10 flex items-center gap-1.5">
                                                    <ArrowRight size={12} className="text-white" />
                                                    <span>{status.nextPlanned.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                                                </div>
                                            ) : status.lastCooked ? (
                                                <div className="absolute top-2 left-2 px-2 py-1 bg-orange-500/90 backdrop-blur-md text-white text-xs font-bold rounded-lg shadow-sm border border-orange-400/20 z-10 flex items-center gap-1.5">
                                                    <ArrowLeft size={12} className="text-white" />
                                                    <span>{status.lastCooked.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                                </div>
                                            ) : null}

                                            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xl font-bold text-white line-clamp-1">{recipe.title}</h3>
                                                    {recipe.hasSubstitutions && (
                                                        <Sparkles size={16} className="text-amber-400 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-white/80 text-sm">{recipe.category || 'Allgemein'}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col justify-between flex-1 gap-4">
                                            <div className="flex items-center justify-between text-muted-foreground text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={16} />
                                                    <span>{(recipe.duration || 0)} min</span>
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
                            )
                        })}
                    </AnimatePresence>
                </div>

                {/* Observer Target for Infinite Scroll */}
                <div ref={observerTarget} className="h-4 w-full" />

                {
                    loading && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => <div key={i} className="aspect-video bg-muted rounded-3xl animate-pulse" />)}
                        </div>
                    )
                }

                {
                    !loading && filteredRecipes.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground italic">
                            Keine Rezepte gefunden.
                        </div>
                    )
                }

                <RecipeModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    recipe={selectedRecipe}
                    onSave={fetchRecipes}
                    initialTab={initialModalTab}
                />
                <AiImportModal
                    isOpen={isAiModalOpen}
                    onClose={() => setIsAiModalOpen(false)}
                    onSave={(newRecipe) => {
                        fetchRecipes();
                        if (newRecipe) {
                            setSelectedRecipe(newRecipe);
                            setIsModalOpen(true);
                        }
                    }}
                />
                {
                    cookingRecipe && (
                        <CookingMode
                            recipe={cookingRecipe}
                            conflicts={cookingConflicts}
                            onClose={() => {
                                setCookingRecipe(null);
                                setCookingConflicts([]);
                            }}
                        />
                    )
                }

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

                {/* Share Confirmation Modal */}
                <ShareConfirmationModal
                    isOpen={!!shareModalConfig}
                    onClose={() => setShareModalConfig(null)}
                    onConfirm={handleConfirmShare}
                />

                <RecipeIntoleranceResolverModal
                    isOpen={!!resolvingRecipe}
                    onClose={() => {
                        setResolvingRecipe(null);
                        setResolvingConflicts([]);
                    }}
                    recipe={resolvingRecipe}
                    conflicts={resolvingConflicts}
                    onResolved={() => {
                        fetchRecipes();
                        setSchedulingRecipe(resolvingRecipe);
                        setResolvingRecipe(null);
                        setResolvingConflicts([]);
                    }}
                />

                <AiLockedModal
                    isOpen={isAiLockedOpen}
                    onClose={() => setIsAiLockedOpen(false)}
                    featureName="AI Assistant"
                />

                {/* Instagram Post Modal */}
                <AnimatePresence>
                    {(isInstaLoading || instaPostResult) && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            >
                                <div className="p-6 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-pink-500/10 rounded-xl text-pink-600">
                                            <Instagram size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bebas tracking-wide">Instagram Post</h2>
                                            <p className="text-sm text-muted-foreground font-medium">KI-generierter Entwurf für Social Media</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setInstaPostResult(null);
                                            setIsInstaLoading(false);
                                            setCopiedInsta(false);
                                        }}
                                        className="p-2 hover:bg-muted rounded-full transition-colors"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {isInstaLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                            <RefreshCw size={48} className="text-pink-500 animate-spin" />
                                            <p className="text-lg font-bold">Generiere Post...</p>
                                            <p className="text-sm text-muted-foreground">Einen Moment bitte.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-muted/30 rounded-2xl p-6 border border-border font-medium text-sm md:text-base leading-relaxed whitespace-pre-wrap select-text">
                                            {instaPostResult}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t border-border bg-card/80 backdrop-blur-md flex flex-wrap justify-end gap-3 rounded-b-3xl">
                                    {!isInstaLoading && instaPostResult && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(instaPostResult);
                                                    setCopiedInsta(true);
                                                    setTimeout(() => setCopiedInsta(false), 2000);
                                                }}
                                                className="gap-2 h-12 px-6"
                                            >
                                                {copiedInsta ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                                {copiedInsta ? 'Kopiert!' : 'Kopieren'}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                onClick={async () => {
                                                    if (navigator.share) {
                                                        try {
                                                            await navigator.share({
                                                                text: instaPostResult
                                                            });
                                                        } catch (err) {
                                                            console.error('Error sharing', err);
                                                        }
                                                    } else {
                                                        alert('Teilen wird von deinem Browser nicht unterstützt.');
                                                    }
                                                }}
                                                className="gap-2 h-12 px-6"
                                            >
                                                <Share2 size={18} />
                                                Teilen
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        onClick={() => {
                                            setInstaPostResult(null);
                                            setIsInstaLoading(false);
                                            setCopiedInsta(false);
                                        }}
                                        className="h-12 px-8 shadow-lg shadow-primary/20"
                                    >
                                        Fertig
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </LoadingOverlay>
    );
}
