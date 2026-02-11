import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ChefHat, Clock, Moon, Play, Printer, Sun, Users } from 'lucide-react';
import { Card } from '../components/Card';
import SharedCookingMode from '../components/SharedCookingMode';
import SharedNotFound from '../components/SharedNotFound';
import { useTheme } from '../contexts/ThemeContext';
import { getImageUrl } from '../lib/utils';


export default function SharedRecipe() {
    const { sharingKey, id } = useParams();
    const navigate = useNavigate();
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { theme, toggleTheme } = useTheme();
    const [isCooking, setIsCooking] = useState(false);
    const isDarkMode = theme === 'dark';

    // Force light mode for printing
    useEffect(() => {
        const handleBeforePrint = () => {
            // Optional: Force light mode logic if needed, but CSS @media print handling usually suffices
        };
        const handleAfterPrint = () => {
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    // Determine API URL based on environment and base path
    const baseURL = import.meta.env.BASE_URL === '/'
        ? '/api'
        : `${import.meta.env.BASE_URL}api`.replace('//', '/');
    const API_URL = import.meta.env.VITE_API_URL || baseURL;

    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                // Ensure we don't have double slashes if API_URL ends with /
                const url = `${API_URL.replace(/\/$/, '')}/recipes/public/${sharingKey}/${id}`;
                const { data } = await axios.get(url);
                setRecipe(data);
            } catch (err) {
                console.error(err);
                setError('Rezept nicht gefunden oder fehlerhaft.');
            } finally {
                setLoading(false);
            }
        };
        fetchRecipe();
    }, [id, API_URL]);

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

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            {/* Header */}
            <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10 print:hidden pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
                            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Zurück"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="w-10 h-10 bg-white dark:bg-card rounded-xl flex items-center justify-center p-1.5 shadow-sm border border-border/50 overflow-hidden">
                            <img
                                src={`${import.meta.env.BASE_URL}icon-512x512.png`}
                                alt="GabelGuru Logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    // Fallback to text if image is missing
                                    e.target.parentElement.style.display = 'none';
                                }}
                            />
                        </div>
                        <span className="font-bebas text-2xl tracking-wider text-primary">GabelGuru</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={isDarkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
                        >
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Drucken"
                        >
                            <Printer size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 space-y-6 flex-1 w-full print:max-w-none print:p-0">
                {/* Print Title Header */}
                <div className="hidden print:block mb-6 space-y-2">
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
                    </div>
                    <div className="absolute top-4 right-4 z-20">
                        <button
                            onClick={() => setIsCooking(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                        >
                            <Play size={20} fill="currentColor" />
                            <span className="hidden sm:inline">Kochmodus</span>
                        </button>
                    </div>
                </div>

                {isCooking && (
                    <SharedCookingMode
                        recipe={recipe}
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

                <div className="grid md:grid-cols-[1fr_1.5fr] gap-6 print:grid-cols-[1fr_2fr] print:gap-8">
                    {/* Ingredients */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 print:text-black">
                            <span className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center text-sm print:border print:border-gray-300 print:text-black print:bg-transparent">1</span>
                            Zutaten
                        </h2>
                        <Card className="divide-y divide-border overflow-hidden print:shadow-none print:border-gray-200">
                            {recipe.RecipeIngredients && recipe.RecipeIngredients.length > 0 ? (
                                recipe.RecipeIngredients.map((ri) => (
                                    <div key={ri.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors print:px-3 print:py-2">
                                        <span className="font-medium print:text-black">
                                            {ri.Product?.name || 'Unbekanntes Produkt'}
                                        </span>
                                        <span className="text-sm text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-md print:bg-transparent print:text-black print:border print:border-gray-200">
                                            {ri.quantity} {ri.unit}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-muted-foreground text-sm italic">
                                    Keine Zutaten gelistet.
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-4 print:space-y-6">
                        {/* Print-only Recipe Image */}
                        {recipe.image_url && (
                            <div className="hidden print:block w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                                <img
                                    src={renderImageUrl(recipe.image_url)}
                                    alt={recipe.title}
                                    className="w-full h-auto object-cover max-h-[300px]"
                                />
                            </div>
                        )}

                        <h2 className="text-xl font-bold flex items-center gap-2 print:text-black">
                            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm print:border print:border-gray-300 print:text-black print:bg-transparent">2</span>
                            Zubereitung
                        </h2>
                        <div className="space-y-4">
                            {recipe.instructions && recipe.instructions.length > 0 ? (
                                recipe.instructions.map((step, idx) => (
                                    <Card key={idx} className="p-4 flex gap-4 hover:shadow-md transition-shadow print:shadow-none print:border-none print:p-0 print:gap-4 print:mb-4">
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center text-sm print:bg-transparent print:border print:border-gray-400 print:text-black print:w-6 print:h-6">
                                            {idx + 1}
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground print:text-black text-justify">
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
            </main>

            <footer className="py-8 text-center text-sm text-muted-foreground print:hidden">
                <p>GabelGuru &copy; Steffen Fleischer 2026</p>
            </footer>

            <style>{`
                @media print {
                    .dark {
                        color-scheme: light !important;
                    }
                    html, body {
                        background: white !important;
                        color: black !important;
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
                }
            `}</style>
        </div>
    );
}
