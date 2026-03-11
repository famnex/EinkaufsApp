import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChefHat, Clock, Play, User, Users, ShieldCheck, ArrowLeft, AlertTriangle, AlertCircle, HelpCircle, Heart } from 'lucide-react';
import IntoleranceIcon from '../components/IntoleranceIcon';
import { Card } from '../components/Card';
import SharedCookingMode from '../components/SharedCookingMode';
import SharedNotFound from '../components/SharedNotFound';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';


export default function SharedRecipe() {
    const { sharingKey, id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCooking, setIsCooking] = useState(false);
    const [conflicts, setConflicts] = useState([]);
    const [activeTooltip, setActiveTooltip] = useState(null); // productId or nulll


    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                // Use authenticated API instance if token exists to see like status
                const { data } = await api.get(`/recipes/public/${sharingKey}/${id}`);
                setRecipe(data);

                // Check for intolerances if logged in AND can access check
                const token = localStorage.getItem('token');
                const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                    ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                    user?.tier?.includes('Admin') || user?.role === 'admin';
                if (token && canAccessCheck && data.RecipeIngredients?.length > 0) {
                    const productIds = data.RecipeIngredients
                        .map(ri => ri.ProductId)
                        .filter(Boolean);

                    if (productIds.length > 0) {
                        try {
                            const { data: conflictData } = await api.post('/intolerances/check', { productIds });
                            setConflicts(conflictData);
                        } catch (err) {
                            console.error('Intolerance check failed', err);
                            if (err.response?.status === 429) {
                                alert(err.response.data.error);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Rezept nicht gefunden oder fehlerhaft.');
            } finally {
                setLoading(false);
            }
        };
        fetchRecipe();
    }, [id, sharingKey]);

    useEffect(() => {
        if (!activeTooltip) return;
        const closeTooltip = () => setActiveTooltip(null);
        document.addEventListener('click', closeTooltip);
        return () => document.removeEventListener('click', closeTooltip);
    }, [activeTooltip]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
            </div>
        );
    }

    if (error || !recipe) {
        return <SharedNotFound />;
    }

    // Helper for Image URL
    const renderImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;

        // Handle production/base path adjustment
        const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;
        // Strip leading slash from url if present to join cleanly with basePath
        const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
        // Strip trailing slash from basePath to avoid double slash
        const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

        return `${cleanBase}/${cleanUrl}`;
    };

    const toggleLike = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                // Potential placeholder for login redirect or message
                return;
            }

            const { data } = await api.post(`/recipes/${id}/favorite`);
            setRecipe(prev => ({
                ...prev,
                isFavorite: data.isFavorite,
                likeCount: data.isFavorite ? (prev.likeCount || 0) + 1 : Math.max(0, (prev.likeCount || 0) - 1)
            }));
        } catch (err) {
            console.error('Failed to toggle like', err);
        }
    };

    const getConflictForProduct = (productId) => {
        const productConflicts = conflicts.filter(c => Number(c.productId) === Number(productId));
        if (productConflicts.length === 0) return null;

        const messages = [];
        let maxProb = 0;
        productConflicts.forEach(pc => {
            if (pc.warnings) {
                pc.warnings.forEach(w => {
                    const householdLabel = pc.username ? ` (${pc.username})` : '';
                    messages.push(`🛑 ${w.message}${householdLabel}`);
                    const prob = w.probability !== undefined ? w.probability : 100;
                    if (prob > maxProb) maxProb = prob;
                });
            }
        });

        if (maxProb <= 30) return null;

        return {
            messages: [...new Set(messages)],
            maxProbability: maxProb
        };
    };

    return (
        <>

            <main className="max-w-3xl mx-auto p-4 space-y-6 flex-1 w-full print:max-w-none print:p-0">
                {/* Print Title Header */}
                <div className="hidden print:block mb-6 space-y-2 print-avoid-break">
                    <h1 className="text-4xl font-bold text-black">{recipe.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="uppercase font-bold tracking-wider border px-2 py-0.5 rounded-md border-gray-300">
                            {recipe.category || 'Rezept'}
                        </span>
                        <div className="flex items-center gap-1">
                            <Clock size={16} />
                            <span>{(recipe.duration || 0)} Min.</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Users size={16} />
                            <span>{recipe.servings} Port.</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1">
                            <User size={14} />
                            <span>{recipe.ownerUsername || 'Unbekannt'}</span>
                        </div>
                        {recipe.cookbookTitle && (
                            <div className="flex items-center gap-1">
                                <ChefHat size={14} />
                                <span>{recipe.cookbookTitle}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Hero Image - Screen Version only */}
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-xl print:hidden">
                    {recipe.image_url ? (
                        <img
                            src={renderImageUrl(recipe.image_url)}
                            alt={recipe.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                            <ChefHat size={64} className="text-muted-foreground/30" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 pt-20 text-white">
                        <span className="px-2 py-1 bg-primary/20 text-primary-foreground text-xs uppercase font-bold rounded-full backdrop-blur-md border border-white/10 mb-2 inline-block">
                            {recipe.category || 'Rezept'}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white shadow-sm">
                            {recipe.title}
                        </h1>
                        {/* Owner info */}
                        <div className="flex items-center gap-3 text-white/70 text-sm mt-2">
                            <span className="flex items-center gap-1">
                                <User size={14} />
                                {recipe.ownerUsername || 'Unbekannt'}
                            </span>
                            {recipe.cookbookTitle && (
                                <>
                                    <span>|</span>
                                    <span className="flex items-center gap-1">
                                        <ChefHat size={14} />
                                        {recipe.cookbookTitle}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Actions Row */}
                <div className="flex md:hidden items-center gap-3 print:hidden">
                    {localStorage.getItem('token') && (
                        <button
                            onClick={toggleLike}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-all font-bold",
                                recipe.isFavorite
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                    : "bg-card border-border text-muted-foreground"
                            )}
                        >
                            <Heart size={20} className={cn(recipe.isFavorite ? "fill-current" : "")} />
                            <span>{recipe.likeCount || 0}</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsCooking(true)}
                        className="flex-3 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        <Play size={18} fill="currentColor" />
                        KOCHMODUS
                    </button>
                    <button
                        onClick={() => navigate(`/compliance?url=${encodeURIComponent(window.location.href)}`)}
                        className="flex-none p-3 bg-muted/50 text-muted-foreground rounded-2xl border border-border"
                        title="Inhalt melden"
                    >
                        <ShieldCheck size={20} />
                    </button>
                </div>

                {isCooking && (
                    <SharedCookingMode
                        recipe={recipe}
                        conflicts={conflicts}
                        onClose={() => setIsCooking(false)}
                    />
                )}

                {/* Meta Stats - Hide in Print (Shown in Header) */}
                <div className="grid grid-cols-2 gap-4 print:hidden">
                    <Card className="p-4 flex flex-col items-center justify-center gap-2 bg-card/50 backdrop-blur-sm">
                        <Clock className="text-primary" size={24} />
                        <div className="text-center">
                            <div className="text-2xl font-bold">{(recipe.duration || 0)}</div>
                            <div className="text-xs text-muted-foreground uppercase font-bold">Minuten</div>
                        </div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center gap-2 bg-card/50 backdrop-blur-sm">
                        <Users className="text-primary" size={24} />
                        <div className="text-center">
                            <div className="text-2xl font-bold">{recipe.servings}</div>
                            <div className="text-xs text-muted-foreground uppercase font-bold">Portionen</div>
                        </div>
                    </Card>
                </div>

                {/* Screen-only Grid Layout */}
                <div className="print:hidden grid md:grid-cols-[1fr_1.5fr] gap-6">
                    {/* Ingredients */}
                    <div className="space-y-6">
                        {/* Mandatory Ingredients */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center text-sm">1</span>
                                Zutaten
                            </h2>
                            <Card className="divide-y divide-border">
                                {recipe.RecipeIngredients && recipe.RecipeIngredients.filter(ri => !ri.isOptional).length > 0 ? (
                                    recipe.RecipeIngredients.filter(ri => !ri.isOptional).map((ri) => {
                                        const productConflicts = getConflictForProduct(ri.ProductId);
                                        return (
                                            <div
                                                key={ri.id}
                                                className={cn(
                                                    "p-3 flex items-center justify-between hover:bg-muted/30 transition-colors relative",
                                                    activeTooltip === ri.id ? "z-40" : "z-0"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {ri.Product?.name || 'Unbekanntes Produkt'}
                                                    </span>
                                                    {productConflicts && (
                                                        <div className="z-50 shrink-0">
                                                            <div
                                                                className={cn(
                                                                    "w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer",
                                                                    productConflicts.maxProbability >= 80 ? "bg-destructive/10 text-destructive animate-pulse ring-1 ring-destructive/20" : "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveTooltip(activeTooltip === ri.id ? null : ri.id);
                                                                }}
                                                            >
                                                                {productConflicts.maxProbability >= 80 ? <AlertCircle size={20} /> : <HelpCircle size={20} />}
                                                            </div>

                                                            {activeTooltip === ri.id && (
                                                                <div
                                                                    className="absolute right-0 bottom-full mb-3 w-64 p-4 bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <div className={cn("font-bold mb-2 flex items-center gap-2", productConflicts.maxProbability >= 80 ? "text-destructive" : "text-orange-500")}>
                                                                        {productConflicts.maxProbability >= 80 ? <AlertCircle size={16} /> : <HelpCircle size={16} />}
                                                                        {productConflicts.maxProbability >= 80 ? 'Achtung!' : 'Hinweis'}
                                                                    </div>
                                                                    <div className="text-muted-foreground mb-2 text-xs">Unverträglichkeit erkannt ({productConflicts.maxProbability}%):</div>
                                                                    <div className="space-y-1">
                                                                        {productConflicts.messages.map((msg, i) => (
                                                                            <div key={i} className={cn(
                                                                                "text-xs font-semibold p-2 rounded-lg border",
                                                                                productConflicts.maxProbability >= 80 ? "bg-destructive/5 text-destructive border-destructive/10" : "bg-orange-500/5 text-orange-500 border-orange-500/10"
                                                                            )}>
                                                                                {msg}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="absolute top-full right-4 w-3 h-3 bg-popover border-r border-b border-border rotate-45 -translate-y-1/2" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-md">
                                                    {ri.quantity > 0 && <span className="mr-1">{ri.quantity.toLocaleString('de-DE')}</span>}
                                                    {ri.unit}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-muted-foreground text-sm italic">
                                        Keine Zutaten gelistet.
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Optional Ingredients */}
                        {recipe.RecipeIngredients && recipe.RecipeIngredients.some(ri => ri.isOptional) && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">+</span>
                                    Optionale Zutaten
                                </h2>
                                <Card className="divide-y divide-border">
                                    {recipe.RecipeIngredients.filter(ri => ri.isOptional).map((ri) => {
                                        const productConflicts = getConflictForProduct(ri.ProductId);
                                        return (
                                            <div
                                                key={ri.id}
                                                className={cn(
                                                    "p-3 flex items-center justify-between hover:bg-muted/30 transition-colors relative",
                                                    activeTooltip === ri.id ? "z-40" : "z-0"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {ri.Product?.name || 'Unbekanntes Produkt'}
                                                    </span>
                                                    {productConflicts && (
                                                        <div className="z-50 shrink-0">
                                                            <div
                                                                className={cn(
                                                                    "w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer",
                                                                    productConflicts.maxProbability >= 80 ? "bg-destructive/10 text-destructive animate-pulse ring-1 ring-destructive/20" : "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveTooltip(activeTooltip === ri.id ? null : ri.id);
                                                                }}
                                                            >
                                                                {productConflicts.maxProbability >= 80 ? <AlertCircle size={20} /> : <HelpCircle size={20} />}
                                                            </div>

                                                            {activeTooltip === ri.id && (
                                                                <div
                                                                    className="absolute right-0 bottom-full mb-3 w-64 p-4 bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <div className={cn("font-bold mb-2 flex items-center gap-2", productConflicts.maxProbability >= 80 ? "text-destructive" : "text-orange-500")}>
                                                                        {productConflicts.maxProbability >= 80 ? <AlertCircle size={16} /> : <HelpCircle size={16} />}
                                                                        {productConflicts.maxProbability >= 80 ? 'Achtung!' : 'Hinweis'}
                                                                    </div>
                                                                    <div className="text-muted-foreground mb-2 text-xs">Unverträglichkeit erkannt ({productConflicts.maxProbability}%):</div>
                                                                    <div className="space-y-1">
                                                                        {productConflicts.messages.map((msg, i) => (
                                                                            <div key={i} className={cn(
                                                                                "text-xs font-semibold p-2 rounded-lg border",
                                                                                productConflicts.maxProbability >= 80 ? "bg-destructive/5 text-destructive border-destructive/10" : "bg-orange-500/5 text-orange-500 border-orange-500/10"
                                                                            )}>
                                                                                {msg}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="absolute top-full right-4 w-3 h-3 bg-popover border-r border-b border-border rotate-45 -translate-y-1/2" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-md">
                                                    {ri.quantity > 0 && <span className="mr-1">{ri.quantity.toLocaleString('de-DE')}</span>}
                                                    {ri.unit}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </Card>
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
                                Zubereitung
                            </h2>
                            <div className="hidden md:flex items-center gap-2">
                                <button
                                    onClick={() => navigate(`/compliance?url=${encodeURIComponent(window.location.href)}`)}
                                    className="flex items-center justify-center p-2.5 bg-muted/50 text-muted-foreground rounded-xl border border-border hover:bg-muted transition-colors"
                                    title="Inhalt melden"
                                >
                                    <ShieldCheck size={20} />
                                </button>
                                <button
                                    onClick={() => setIsCooking(true)}
                                    className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    <Play size={18} fill="currentColor" />
                                    KOCHMODUS
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {recipe.instructions && recipe.instructions.length > 0 ? (
                                recipe.instructions.map((step, idx) => (
                                    <Card key={idx} className="p-4 flex gap-4 hover:shadow-md transition-shadow">
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center text-sm">
                                            {idx + 1}
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground text-justify">
                                            {step}
                                        </p>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground italic p-8 border-2 border-dashed border-border rounded-xl">
                                    Keine Schritte hinterlegt.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Print-only Table Layout (Solves Chrome Pagination) */}
                <table className="hidden print:table w-full border-collapse border-none">
                    <tbody>
                        <tr>
                            <td className="w-[35%] align-top pr-8 pb-4 border-none">
                                {/* Ingredients Column */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md border border-gray-300 flex items-center justify-center text-sm">1</span>
                                            Zutaten
                                        </h2>
                                        <div className="border border-gray-200 rounded-xl overflow-visible">
                                            {recipe.RecipeIngredients && recipe.RecipeIngredients.filter(ri => !ri.isOptional).length > 0 ? (
                                                recipe.RecipeIngredients.filter(ri => !ri.isOptional).map((ri) => {
                                                    const productConflicts = getConflictForProduct(ri.ProductId);
                                                    return (
                                                        <div key={ri.id} className="p-3 border-b border-gray-100 last:border-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-black">
                                                                    {ri.Product?.name || 'Unbekanntes Produkt'}
                                                                </span>
                                                                <span className="text-xs font-semibold text-black border border-gray-200 px-2 py-0.5 rounded-md">
                                                                    {ri.quantity > 0 && <span className="mr-1">{ri.quantity.toLocaleString('de-DE')}</span>}
                                                                    {ri.unit}
                                                                </span>
                                                            </div>
                                                            {productConflicts && (
                                                                <div className={cn(
                                                                    "text-[10px] font-bold leading-tight",
                                                                    productConflicts.maxProbability >= 80 ? "text-red-600" : "text-orange-600"
                                                                )}>
                                                                    {productConflicts.messages.join(' | ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-4 text-center text-gray-400 text-sm italic">
                                                    Keine Zutaten.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {recipe.RecipeIngredients && recipe.RecipeIngredients.some(ri => ri.isOptional) && (
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-md border border-gray-300 flex items-center justify-center text-sm">+</span>
                                                Optionale Zutaten
                                            </h2>
                                            <div className="border border-gray-200 rounded-xl overflow-visible">
                                                {recipe.RecipeIngredients.filter(ri => ri.isOptional).map((ri) => {
                                                    const productConflicts = getConflictForProduct(ri.ProductId);
                                                    return (
                                                        <div key={ri.id} className="p-3 border-b border-gray-100 last:border-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-black">
                                                                    {ri.Product?.name || 'Unbekanntes Produkt'}
                                                                </span>
                                                                <span className="text-xs font-semibold text-black border border-gray-200 px-2 py-0.5 rounded-md">
                                                                    {ri.quantity > 0 && <span className="mr-1">{ri.quantity.toLocaleString('de-DE')}</span>}
                                                                    {ri.unit}
                                                                </span>
                                                            </div>
                                                            {productConflicts && (
                                                                <div className={cn(
                                                                    "text-[10px] font-bold leading-tight",
                                                                    productConflicts.maxProbability >= 80 ? "text-red-600" : "text-orange-600"
                                                                )}>
                                                                    {productConflicts.messages.join(' | ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="w-[65%] align-top pb-4 border-none">
                                {/* Image & Instructions Column */}
                                {recipe.image_url && (
                                    <div className="mb-6 rounded-2xl overflow-hidden border border-gray-100 shadow-sm print-avoid-break">
                                        <img
                                            src={renderImageUrl(recipe.image_url)}
                                            alt={recipe.title}
                                            className="w-full h-auto object-cover max-h-[300px]"
                                        />
                                    </div>
                                )}

                                <h2 className="text-xl font-bold mb-4 text-black flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md border border-gray-300 flex items-center justify-center text-sm">2</span>
                                    Zubereitung
                                </h2>
                                <div className="space-y-4">
                                    {recipe.instructions && recipe.instructions.length > 0 ? (
                                        recipe.instructions.map((step, idx) => (
                                            <div key={idx} className="flex gap-4 mb-4 break-inside-avoid page-break-inside-avoid">
                                                <div className="shrink-0 w-6 h-6 rounded-full border border-gray-400 text-black font-bold flex items-center justify-center text-sm">
                                                    {idx + 1}
                                                </div>
                                                <p className="leading-relaxed text-black text-justify flex-1">
                                                    {step}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl text-center italic text-gray-400">
                                            Keine Schritte.
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </main>

            <style>{`
                @media print {
                    .dark {
                        color-scheme: light !important;
                    }
                    html, body {
                        background: white !important;
                        color: black !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    .bg-card, .bg-muted, .bg-secondary\\/10, .bg-primary\\/10 {
                        background-color: transparent !important;
                        background: transparent !important;
                    }
                    * {
                        box-shadow: none !important;
                        text-shadow: none !important;
                        border-color: #e5e7eb !important;
                        color: black !important;
                    }
                    .text-primary, .text-secondary, .text-muted-foreground {
                        color: black !important;
                    }
                    
                    .print-avoid-break {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>
        </>
    );
}
