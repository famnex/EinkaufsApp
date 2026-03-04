import { useState, useEffect, useMemo, useRef } from 'react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import api from '../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ChefHat, Clock, Users, Sparkles, MoreHorizontal, Share2, Calendar, Printer, ArrowLeft, ArrowRight, Dices, ShieldAlert, Edit, Heart, RefreshCw, Menu, ArrowUpDown, ChevronDown, Lock, Instagram, Copy, X, Check, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
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
import { useTutorial } from '../contexts/TutorialContext';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Recipes() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { notifyAction, activeChapter, currentStepIndex } = useTutorial();
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

    // Sync ref for tutorial state to avoid stale closure in document listener
    const tutorialStateRef = useRef({ activeChapter, currentStepIndex });
    useEffect(() => {
        tutorialStateRef.current = { activeChapter, currentStepIndex };
    }, [activeChapter, currentStepIndex]);

    // Close menu on outside click
    useEffect(() => {
        const closeMenu = (e) => {
            // Definitiv check via sessionStorage to avoid any React state race conditions
            const activeChapterVal = sessionStorage.getItem('activeTutorialChapter');
            const stepIndexVal = parseInt(sessionStorage.getItem('tutorialStepIndex') || '0');

            // Ignore clicks on tutorial UI elements itself
            const isDriverElement = e.target.closest('.driverjs-popover') ||
                e.target.closest('.driverjs-overlay') ||
                e.target.closest('.driver-popover') ||
                e.target.closest('#driver-popover-item') ||
                e.target.closest('#driver-page-overlay') ||
                e.target.closest('.driverjs-canvas');

            if (isDriverElement) return;

            // During tutorial steps that highlight menu options (0-3), don't close the menu at all
            if (activeChapterVal === 'rezepte' && stepIndexVal >= 0 && stepIndexVal <= 3) {
                return;
            }

            setOpenMenuId(null);

            if (isMobileMenuOpen && e.target.closest('.recipe-menu-options') === null && e.target.closest('#recipe-burger-menu') === null) {
                setIsMobileMenuOpen(false);
            }
        };
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, [isMobileMenuOpen]);



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
                const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                    ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                    user?.tier?.includes('Admin') || user?.role === 'admin';
                if (!canAccessCheck) {
                    setCookingConflicts([]);
                } else {
                    try {
                        const { data: conflictData } = await api.post('/intolerances/check', { productIds });
                        setCookingConflicts(conflictData);
                    } catch (err) {
                        console.error('Failed to check intolerances', err);
                        if (err.response?.status === 429) {
                            alert(err.response.data.error);
                        }
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
                const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                    ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                    user?.tier?.includes('Admin') || user?.role === 'admin';
                if (canAccessCheck) {
                    try {
                        const { data: conflicts } = await api.post('/intolerances/check', { productIds: productIdsToCheck });
                        const severeConflicts = conflicts.filter(c => c.maxProbability >= 30);

                        if (severeConflicts.length > 0) {
                            setResolvingRecipe(fullRecipe);
                            setResolvingConflicts(severeConflicts);
                            return;
                        }
                    } catch (err) {
                        console.error('Failed to check intolerances before planning', err);
                        if (err.response?.status === 429) {
                            alert(err.response.data.error);
                            // Optional: abort planning if critical? 
                            // But usually we just let them continue without check if it's fair use.
                        }
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
    const [sortBy, setSortBy] = useState('Veröffentlichung');
    const [sortOrder, setSortOrder] = useState('desc');

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
                matchesCategory = String(r.UserId) === String(effectiveUserId) || r.isFavorite;
            } else if (selectedCategory === 'Ohne Bilder') {
                matchesCategory = (String(r.UserId) === String(effectiveUserId) || r.isFavorite) && !r.image_url;
            } else if (selectedCategory === 'Meine Favoriten') {
                matchesCategory = r.isFavorite === true; // Show all favorites for ME
            } else if (selectedCategory.startsWith('Favoriten von ')) {
                const nameMatches = selectedCategory.replace('Favoriten von ', '');
                matchesCategory = r.favoritedBy && r.favoritedBy.includes(nameMatches);
            } else {
                matchesCategory = (String(r.UserId) === String(effectiveUserId) || r.isFavorite) && r.category === selectedCategory;
            }

            return matchesSearch && matchesCategory;
        }).sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'Alphabet':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'Zubereitungshäufigkeit':
                    comparison = (a.cookCount || 0) - (b.cookCount || 0);
                    break;
                case 'Likes':
                    comparison = (a.favoritedBy?.length || 0) - (b.favoritedBy?.length || 0);
                    break;
                case 'Klicks':
                    comparison = (a.clicks || 0) - (b.clicks || 0);
                    break;
                case 'Zutaten':
                    comparison = (a.RecipeIngredients?.length || 0) - (b.RecipeIngredients?.length || 0);
                    break;
                case 'Kochzeit':
                    const timeA = (a.prep_time || 0) + (a.duration || 0);
                    const timeB = (b.prep_time || 0) + (b.duration || 0);
                    comparison = timeA - timeB;
                    break;
                case 'Veröffentlichung':
                    comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    break;
                default:
                    comparison = 0;
            }
            if (comparison === 0) comparison = a.title.localeCompare(b.title);
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [recipes, searchTerm, selectedCategory, sortBy, sortOrder]);

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
            const actualSharingKey = data.householdSharingKey || data.sharingKey;
            const actualUrl = shareModalConfig.url.replace('/shared//', `/shared/${actualSharingKey}/`).replace('/shared/undefined/', `/shared/${actualSharingKey}/`);

            // Proceed with share
            executeShare(shareModalConfig.title, shareModalConfig.text, actualUrl);
        } catch (err) {
            console.error('Failed to enable public cookbook', err);
            alert('Fehler beim Aktivieren des öffentlichen Kochbuchs.');
        } finally {
            setShareModalConfig(null);
        }
    };

    const handleToggleVisibility = async (e, recipe) => {
        e.stopPropagation();
        try {
            const { data } = await api.patch(`/recipes/${recipe.id}/visibility`);
            setRecipes(prev => prev.map(r => r.id === data.id ? { ...r, isPublic: data.isPublic } : r));
        } catch (err) {
            console.error('Failed to toggle visibility', err);
            alert('Fehler beim Ändern der Sichtbarkeit.');
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
            notifyAction('recipe-like');
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
                            "relative transition-all duration-300 ease-in-out overflow-hidden bg-muted/50 rounded-xl cursor-pointer md:bg-transparent md:cursor-default",
                            mobileActiveFilter === 'search' ? "flex-1" : "w-12",
                            "md:flex-1 md:w-auto"
                        )}
                        onClick={() => { if (window.innerWidth < 768) setMobileActiveFilter('search'); }}
                    >
                        <Search
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-300",
                                mobileActiveFilter !== 'search' ? "left-1/2 -translate-x-1/2" : "left-4",
                                "md:left-4 md:translate-x-0"
                            )}
                            size={20}
                        />
                        <Input
                            placeholder="Rezept suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => { if (window.innerWidth < 768) setMobileActiveFilter('search'); }}
                            className={cn(
                                "pl-12 h-12 bg-card border-border shadow-sm transition-all duration-300 w-full",
                                mobileActiveFilter !== 'search' ? "opacity-0 pointer-events-none" : "opacity-100",
                                "md:opacity-100 md:pointer-events-auto"
                            )}
                        />
                    </div>

                    {/* Category Dropdown */}
                    <div
                        className={cn(
                            "relative transition-all duration-300 ease-in-out bg-muted/50 rounded-xl cursor-pointer md:bg-transparent md:cursor-default",
                            mobileActiveFilter === 'category' ? "flex-1" : "w-12",
                            "md:w-64"
                        )}
                        onClick={() => { if (window.innerWidth < 768) setMobileActiveFilter('category'); }}
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
                            onFocus={() => { if (window.innerWidth < 768) setMobileActiveFilter('category'); }}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                e.target.blur();
                            }}
                            className={cn(
                                "h-12 w-full bg-card border border-border rounded-xl shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none px-4 transition-all duration-300 md:pl-12",
                                mobileActiveFilter !== 'category' ? "opacity-0 pointer-events-none" : "opacity-100",
                                "md:opacity-100 md:pointer-events-auto"
                            )}
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'Alle Kategorien' : cat}</option>)}
                        </select>

                        {/* Chevron for expanded state */}
                        <div className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300",
                            mobileActiveFilter === 'category' ? "opacity-100" : "opacity-0",
                            "md:opacity-100"
                        )}>
                            <ChevronDown size={16} className="text-muted-foreground" />
                        </div>
                    </div>

                    {/* Sorting Dropdown */}
                    <div
                        className={cn(
                            "relative transition-all duration-300 ease-in-out bg-muted/50 rounded-xl cursor-pointer md:bg-transparent md:cursor-default",
                            mobileActiveFilter === 'sort' ? "flex-1" : "w-12",
                            "md:flex-1 md:max-w-[280px]"
                        )}
                        onClick={() => { if (window.innerWidth < 768) setMobileActiveFilter('sort'); }}
                    >
                        {/* Collapsed Icon (Mobile) */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 md:hidden",
                            mobileActiveFilter === 'sort' ? "opacity-0" : "opacity-100"
                        )}>
                            <ArrowUpDown size={20} className="text-muted-foreground" />
                        </div>

                        {/* Desktop Icon (Left Side) */}
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none text-muted-foreground z-10">
                            <ArrowUpDown size={18} />
                        </div>

                        <div className="flex items-center gap-2 h-12">
                            <select
                                value={sortBy}
                                onFocus={() => { if (window.innerWidth < 768) setMobileActiveFilter('sort'); }}
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    e.target.blur();
                                }}
                                className={cn(
                                    "h-full w-full bg-card border border-border rounded-xl shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none px-4 transition-all duration-300 md:pl-10 pr-10",
                                    mobileActiveFilter !== 'sort' ? "opacity-0 pointer-events-none" : "opacity-100",
                                    "md:opacity-100 md:pointer-events-auto"
                                )}
                            >
                                {['Alphabet', 'Veröffentlichung', 'Likes', 'Klicks', 'Zubereitungshäufigkeit', 'Kochzeit', 'Zutaten'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>

                            {/* Chevron for select */}
                            <div className={cn(
                                "absolute right-14 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300 hidden md:block",
                                "md:opacity-100"
                            )}>
                                <ChevronDown size={16} className="text-muted-foreground" />
                            </div>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                }}
                                className={cn(
                                    "h-12 w-12 flex items-center justify-center shrink-0 rounded-xl bg-card border border-border hover:bg-muted transition-all focus:ring-2 focus:ring-primary/20",
                                    mobileActiveFilter !== 'sort' && window.innerWidth < 768 ? "hidden" : "flex"
                                )}
                            >
                                {sortOrder === 'asc' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="h-12 w-px bg-border mx-1 hidden md:block" />

                    {/* Burger Menu (Always visible now) */}
                    <div className="relative">
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMobileMenuOpen(!isMobileMenuOpen);
                                if (!isMobileMenuOpen) notifyAction('recipe-menu-open');
                            }}
                            variant="ghost"
                            size="icon"
                            id="recipe-burger-menu"
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
                                    className="absolute right-0 top-full mt-2 w-56 py-2 rounded-2xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl z-[100] overflow-hidden recipe-menu-options"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Order: Rezept erstellen, AI Import, Zufalls-Rezept, ---, Kochbuch teilen */}
                                    <button
                                        id="tutorial-create-recipe-btn"
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                        onClick={() => {
                                            setIsModalOpen(true);
                                            setSelectedRecipe(null);
                                            if (sessionStorage.getItem('activeTutorialChapter') !== 'rezepte') {
                                                setIsMobileMenuOpen(false);
                                            }
                                        }}
                                    >
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <Plus size={18} />
                                        </div>
                                        Rezept erstellen
                                    </button>

                                    {user?.tier !== 'Plastikgabel' ? (
                                        <button
                                            id="tutorial-ai-import-btn"
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                            onClick={() => {
                                                setIsAiModalOpen(true);
                                                if (sessionStorage.getItem('activeTutorialChapter') !== 'rezepte') {
                                                    setIsMobileMenuOpen(false);
                                                }
                                            }}
                                        >
                                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                                <Sparkles size={18} />
                                            </div>
                                            AI Import
                                        </button>
                                    ) : (
                                        <button
                                            id="tutorial-ai-import-locked-btn"
                                            className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors text-muted-foreground font-medium opacity-60 relative"
                                            onClick={() => {
                                                setIsAiLockedOpen(true);
                                                if (sessionStorage.getItem('activeTutorialChapter') !== 'rezepte') {
                                                    setIsMobileMenuOpen(false);
                                                }
                                            }}
                                        >
                                            <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                                                <Sparkles size={18} />
                                            </div>
                                            AI Import
                                            <Lock size={13} className="ml-auto opacity-70" />
                                        </button>
                                    )}

                                    <button
                                        id="shuffle-recipes-btn"
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                        onClick={() => {
                                            setIsSlotMachineOpen(true);
                                            if (sessionStorage.getItem('activeTutorialChapter') !== 'rezepte') {
                                                setIsMobileMenuOpen(false);
                                            }
                                            notifyAction('dice-click');
                                        }}
                                    >
                                        <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
                                            <Dices size={18} />
                                        </div>
                                        Zufalls-Rezept
                                    </button>

                                    <div className="h-px bg-border mx-2 my-1" />

                                    <button
                                        id="tutorial-share-cookbook-btn"
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 transition-colors text-foreground font-medium"
                                        onClick={() => {
                                            handleShareRequest(
                                                'Mein Kochbuch',
                                                'Schau dir mein Kochbuch an!',
                                                `${window.location.origin}${import.meta.env.BASE_URL}shared/${user?.householdSharingKey || user?.sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1")
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
                            const isForeign = String(recipe.UserId) !== String(effectiveUserId);
                            return (
                                <motion.div
                                    key={recipe.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                                    onClick={() => {
                                        if (editMode === 'delete' && !isForeign) {
                                            handleDelete(recipe.id, recipe.title);
                                        } else if (editMode === 'edit' && !isForeign) {
                                            setSelectedRecipe(recipe);
                                            setIsModalOpen(true);
                                        } else {
                                            handleOpenCookingMode(recipe);
                                            notifyAction('cook-mode-start');
                                        }
                                    }}
                                    className={cn(
                                        "cursor-pointer group relative transition-all duration-300 recipe-cook-btn",
                                        editMode === 'delete' && !isForeign ? 'ring-2 ring-destructive ring-offset-2 rounded-3xl' : '',
                                        openMenuId === recipe.id ? 'z-[40]' : 'z-10'
                                    )}
                                >
                                    <Card className={cn(
                                        "h-full transition-all duration-300 bg-card flex flex-col relative overflow-visible", // overflow-hidden removed to allow Action Menu to protrude
                                        isForeign
                                            ? "border-amber-500/30 shadow-amber-500/5 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10"
                                            : "border-border hover:shadow-xl"
                                    )}>
                                        {isForeign && (
                                            /* Äußerer Container mit deinen Wunschwerten */
                                            <div className="absolute top-[17px] left-[-15px] w-[100px] h-16 pointer-events-none z-30 overflow-visible">
                                                <div className="absolute top-0 left-0 bg-amber-500 text-white text-[10px] font-black py-1 px-10 -rotate-45 -translate-x-6 translate-y-2 shadow-lg flex items-center justify-center gap-1">
                                                    <Users size={8} className="fill-white" />
                                                    COMMUNITY
                                                </div>
                                            </div>
                                        )}
                                        <div className="aspect-video relative bg-muted shrink-0 overflow-hidden rounded-t-2xl">
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
                                                        // HIER DIE ENTSCHEIDENDEN KLASSEN:
                                                        className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 opacity-0"
                                                    />
                                                    {/* Local Spinner while img is opacity-0 */}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-muted z-0">
                                                        <ChefHat className="text-muted-foreground/30" size={48} />
                                                    </div>
                                                </div>
                                            ) : recipe.imageSource === 'none' ? (
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                                                    <ChefHat size={48} />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                                    <ChefHat className="text-muted-foreground/30" size={48} />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                                            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xl font-bold text-white line-clamp-1">{recipe.title}</h3>
                                                    {recipe.isPublic === false && (
                                                        <div className="bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shrink-0" title="Dieses Rezept ist nicht öffentlich sichtbar">
                                                            <EyeOff size={12} className="text-white/70" />
                                                            <span className="text-[10px] text-white/70 font-bold uppercase tracking-tighter">Versteckt</span>
                                                        </div>
                                                    )}
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

                                        {/* Floating elements outside overflow-hidden */}
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

                                        {/* Action Menu Trigger - Outside overflow-hidden */}
                                        <div
                                            className="absolute top-2 right-2 z-20"
                                            onClick={(e) => {
                                                e.stopPropagation();
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
                                                        className="absolute top-12 right-0 p-2 rounded-full backdrop-blur-sm bg-black/20 hover:bg-black/40 text-white transition-all duration-200 focus:outline-none recipe-like-btn"
                                                        title="Zu Favoriten hinzufügen/entfernen"
                                                    >
                                                        <Heart
                                                            size={20}
                                                            className={cn("transition-colors duration-300", recipe.isFavorite ? "fill-rose-500 text-rose-500" : "text-white")}
                                                        />
                                                    </button>
                                                </div>

                                                <AnimatePresence>
                                                    {openMenuId === recipe.id && (
                                                        <motion.div
                                                            key={recipe.id + '-action-menu'}
                                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            transition={{ duration: 0.1 }}
                                                            className="absolute right-0 top-full mt-2 w-48 py-1 rounded-xl bg-popover/95 backdrop-blur-xl border border-white/10 shadow-xl z-999999 overflow-hidden"
                                                        >
                                                            {!isForeign && (
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
                                                            )}

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
                                                                className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground recipe-schedule-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePlanClick(recipe);
                                                                    setOpenMenuId(null);
                                                                    notifyAction('recipe-schedule');
                                                                }}
                                                            >
                                                                <Calendar size={16} />
                                                                Einplanen
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

                                                            <button
                                                                className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const baseUrl = import.meta.env.BASE_URL;
                                                                    const link = `${window.location.origin}${baseUrl}shared/${user?.sharingKey}/recipe/${recipe.id}?print=true`.replace(/([^:]\/)\/+/g, "$1");
                                                                    window.open(link, '_blank');
                                                                    setOpenMenuId(null);
                                                                }}
                                                            >
                                                                <Printer size={16} />
                                                                Drucken
                                                            </button>

                                                            {!isForeign && (
                                                                <button
                                                                    className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                    onClick={(e) => {
                                                                        handleToggleVisibility(e, recipe);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    {recipe.isPublic !== false ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                    {recipe.isPublic !== false ? 'Verstecken' : 'Veröffentlichen'}
                                                                </button>
                                                            )}

                                                            {!isForeign && (
                                                                <button
                                                                    className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-3 transition-colors font-bold"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(recipe.id, recipe.title);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                >
                                                                    <X size={16} />
                                                                    Löschen
                                                                </button>
                                                            )}

                                                            <div className="h-px bg-white/10 mx-2 my-1" />

                                                            <button
                                                                className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-white/10 flex items-center gap-3 transition-colors text-foreground"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const baseUrl = import.meta.env.BASE_URL;
                                                                    const sharingKey = recipe.ownerSharingKey || user?.householdSharingKey || user?.sharingKey;
                                                                    const link = `${window.location.origin}${baseUrl}shared/${sharingKey}/recipe/${recipe.id}`.replace(/([^:]\/)\/+/g, "$1");

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
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
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
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-6 text-muted-foreground/30">
                                <ChefHat size={40} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Keine Rezepte gefunden</h3>
                            <p className="text-muted-foreground mb-8 max-w-md italic">
                                {searchTerm
                                    ? "Deine Suche ergab leider keine Treffer."
                                    : "Du hast noch keine eigenen Rezepte. Schau doch mal in den Community Cookbooks vorbei und füge Rezepte anderer Nutzer hinzu!"}
                            </p>
                            <Button
                                onClick={() => navigate('/community-cookbooks')}
                                className="rounded-2xl gap-2 font-bold px-8 shadow-lg shadow-primary/10"
                                variant="outline"
                            >
                                <Users size={18} />
                                Community Rezepte entdecken
                            </Button>
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
                    featureName="AI Import"
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
