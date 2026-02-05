import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { X, Dices, ChefHat, Filter, Sparkles, Play, Check, Search, Plus, Loader2, Calendar } from 'lucide-react';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';

export default function SlotMachineModal({ isOpen, onClose, recipes, onSelect }) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const [excludedIngredients, setExcludedIngredients] = useState([]);
    const [includedIngredients, setIncludedIngredients] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [allProducts, setAllProducts] = useState([]);
    const [incSearch, setIncSearch] = useState('');
    const [exSearch, setExSearch] = useState('');
    const [showIncSuggestions, setShowIncSuggestions] = useState(false);
    const [showExSuggestions, setShowExSuggestions] = useState(false);

    const audioContextRef = useRef(null);
    const doodleIntervalRef = useRef(null);

    const playSound = useCallback((type) => {
        try {
            if (!audioContextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) audioContextRef.current = new AudioContext();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            if (type === 'doodle') {
                const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25]; // Melodic loop
                const now = ctx.currentTime;
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + i * 0.1);
                    gain.gain.setValueAtTime(0, now + i * 0.1);
                    gain.gain.linearRampToValueAtTime(0.05, now + i * 0.1 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.08);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.1);
                    osc.stop(now + i * 0.1 + 0.1);
                });
            } else if (type === 'jackpot') {
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
                    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
                    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.1 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.1);
                    osc.stop(ctx.currentTime + i * 0.1 + 0.4);
                });
            }
        } catch (e) { console.warn("Audio failed", e); }
    }, []);

    // Animation control
    const [reelItems, setReelItems] = useState([]);
    const reelRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            api.get('/products').then(res => setAllProducts(res.data)).catch(console.error);
        } else {
            // Cleanup audio when closing
            if (doodleIntervalRef.current) {
                clearInterval(doodleIntervalRef.current);
                doodleIntervalRef.current = null;
            }
        }
        return () => {
            if (doodleIntervalRef.current) clearInterval(doodleIntervalRef.current);
        };
    }, [isOpen]);

    const categories = useMemo(() => {
        return ['All', ...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
    }, [recipes]);

    const filteredPool = useMemo(() => {
        return recipes.filter(r => {
            const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;

            const matchesExcludes = excludedIngredients.length === 0 || !excludedIngredients.some(ex =>
                r.title.toLowerCase().includes(ex.toLowerCase()) ||
                r.RecipeIngredients?.some(ri => ri.Product?.name.toLowerCase().includes(ex.toLowerCase()))
            );

            const matchesIncludes = includedIngredients.length === 0 || includedIngredients.every(inc =>
                r.title.toLowerCase().includes(inc.toLowerCase()) ||
                r.RecipeIngredients?.some(ri => ri.Product?.name.toLowerCase().includes(inc.toLowerCase()))
            );

            return matchesCategory && matchesExcludes && matchesIncludes;
        });
    }, [recipes, selectedCategory, excludedIngredients, includedIngredients]);

    const spin = useCallback(async () => {
        if (filteredPool.length === 0) return;

        // Clear any existing audio intervals
        if (doodleIntervalRef.current) clearInterval(doodleIntervalRef.current);

        setIsSpinning(true);
        setResult(null);

        // Prepare the reel: A long list of random recipes ending in a set of possibilities
        const totalItems = 30;
        const pool = recipes.length > 0 ? recipes : filteredPool;
        const newReel = Array.from({ length: totalItems }, () => pool[Math.floor(Math.random() * pool.length)]);

        // Pick the actual winner from the filtered pool
        const winner = filteredPool[Math.floor(Math.random() * filteredPool.length)];
        newReel[newReel.length - 1] = winner;

        setReelItems(newReel);

        // Start the "Gedudel" (Melodic Arpeggio)
        playSound('doodle'); // Play once immediately
        doodleIntervalRef.current = setInterval(() => {
            playSound('doodle');
        }, 600); // 6 notes * 0.1s = 0.6s sequence

        // Animation timing handled by the CSS/Motion combination
        setTimeout(() => {
            if (doodleIntervalRef.current) {
                clearInterval(doodleIntervalRef.current);
                doodleIntervalRef.current = null;
            }
            setResult(winner);
            setIsSpinning(false);
            playSound('jackpot');
        }, 3500); // Sync with animation duration
    }, [filteredPool, recipes, playSound]);

    const incSuggestions = useMemo(() => {
        if (!incSearch) return [];
        return allProducts
            .filter(p => p.name.toLowerCase().includes(incSearch.toLowerCase()) && !includedIngredients.includes(p.name))
            .slice(0, 5);
    }, [incSearch, allProducts, includedIngredients]);

    const exSuggestions = useMemo(() => {
        if (!exSearch) return [];
        return allProducts
            .filter(p => p.name.toLowerCase().includes(exSearch.toLowerCase()) && !excludedIngredients.includes(p.name))
            .slice(0, 5);
    }, [exSearch, allProducts, excludedIngredients]);

    if (!isOpen) return null;

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white shadow-xl">
                                    <Dices size={24} className="animate-bounce" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight">Roulette Royale</h3>
                                    <p className="text-xs opacity-80 font-medium">Dein Glück entscheidet heute!</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white relative z-50">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 bg-gradient-to-b from-amber-500/5 to-background max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {/* The "Machine" View with Vertical Scroll */}
                            <div className="relative aspect-video rounded-3xl bg-black overflow-hidden border-8 border-muted/50 shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center justify-center group shrink-0">
                                {/* Neon Border Accent */}
                                <div className="absolute inset-0 border-2 border-amber-500/50 rounded-2xl pointer-events-none z-30 opacity-50 shadow-[inset_0_0_20px_rgba(245,158,11,0.2)]" />

                                <AnimatePresence mode="wait">
                                    {isSpinning ? (
                                        <motion.div
                                            key="spinning"
                                            initial={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="w-full h-full relative overflow-hidden"
                                        >
                                            <motion.div
                                                initial={{ y: 0 }}
                                                animate={{ y: `-${(reelItems.length - 1) * 100}%` }}
                                                transition={{
                                                    duration: 3.5,
                                                    ease: [0.45, 0.05, 0.55, 0.95]
                                                }}
                                                className="absolute inset-0"
                                            >
                                                {reelItems.map((item, i) => (
                                                    <div key={i} className="w-full h-full flex flex-col items-center justify-center relative shrink-0">
                                                        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#000_70%)] z-10" />
                                                        {item.image_url ? (
                                                            <img src={getImageUrl(item.image_url)} className="w-full h-full object-cover opacity-60" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-amber-500/10">
                                                                <ChefHat size={80} />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 flex items-center justify-center z-20">
                                                            <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white/30 text-center px-10">
                                                                {item.title}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    ) : result ? (
                                        <motion.div
                                            key="result"
                                            initial={{ scale: 0.5, rotate: -5, opacity: 0 }}
                                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="w-full h-full relative"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-10" />
                                            {result.image_url ? (
                                                <img src={getImageUrl(result.image_url)} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white">
                                                    <ChefHat size={100} />
                                                </div>
                                            )}
                                            <div className="absolute bottom-6 left-6 right-6 z-20">
                                                <motion.div
                                                    initial={{ y: 50, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, type: 'spring' }}
                                                    className="flex flex-col"
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-amber-500/40">Jackpot!</span>
                                                        {result.category && <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-md">{result.category}</span>}
                                                    </div>
                                                    <h4 className="text-3xl font-black text-white leading-[1.1] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{result.title}</h4>
                                                </motion.div>
                                            </div>
                                            <motion.div
                                                initial={{ scale: 0, rotate: -45 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: 'spring', damping: 8, stiffness: 200, delay: 0.2 }}
                                                className="absolute top-4 right-4 z-20 bg-gradient-to-br from-amber-400 to-orange-600 text-white p-4 rounded-full shadow-2xl ring-4 ring-white/20"
                                            >
                                                <Sparkles size={32} />
                                            </motion.div>
                                        </motion.div>
                                    ) : filteredPool.length > 0 ? (
                                        <motion.div
                                            key="ready"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center p-8 z-20"
                                        >
                                            <Dices size={60} className="mx-auto text-amber-500 mb-4 opacity-50 animate-bounce" />
                                            <p className="text-amber-500/80 font-black uppercase tracking-[0.2em] text-lg">Bereit zum Drehen!</p>
                                            <p className="text-amber-500/40 text-[10px] uppercase tracking-widest font-bold mt-1">
                                                {filteredPool.length} Rezepte im Pool
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="no-matches"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center p-8 z-20"
                                        >
                                            <Filter size={60} className="mx-auto text-amber-500 mb-4 opacity-30 animate-pulse" />
                                            <p className="text-amber-500/60 font-medium uppercase tracking-[0.2em] text-xs">Pech gehabt!<br /><span className="text-[10px] opacity-50">Keine Übereinstimmung</span></p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Configuration */}
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategorie</label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="w-full h-11 bg-muted/50 border border-border rounded-2xl px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'Alle Kategorien' : c}</option>)}
                                    </select>
                                </div>

                                {/* Included Ingredients (Tags) */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Zutaten</label>
                                    <div className="min-h-[2.75rem] p-1.5 bg-muted/50 border border-border rounded-2xl flex flex-wrap gap-1.5 items-center">
                                        {includedIngredients.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => setIncludedIngredients(prev => prev.filter(t => t !== tag))}
                                                className="px-3 py-1 bg-amber-500/10 text-amber-600 text-xs font-bold rounded-lg border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
                                            >
                                                {tag}
                                                <X size={12} />
                                            </button>
                                        ))}
                                        <input
                                            placeholder={includedIngredients.length === 0 ? "Nach Produkten suchen..." : "Weitere..."}
                                            value={incSearch}
                                            onChange={(e) => { setIncSearch(e.target.value); setShowIncSuggestions(true); }}
                                            onFocus={() => setShowIncSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowIncSuggestions(false), 200)}
                                            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm px-2 h-7"
                                        />
                                    </div>
                                    {showIncSuggestions && incSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            {incSuggestions.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => { setIncludedIngredients(prev => [...prev, p.name]); setIncSearch(''); }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between group"
                                                >
                                                    {p.name}
                                                    <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Excluded Ingredients (Tags) */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ausschließen</label>
                                    <div className="min-h-[2.75rem] p-1.5 bg-muted/50 border border-border rounded-2xl flex flex-wrap gap-1.5 items-center">
                                        {excludedIngredients.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => setExcludedIngredients(prev => prev.filter(t => t !== tag))}
                                                className="px-3 py-1 bg-rose-500/10 text-rose-600 text-xs font-bold rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                                            >
                                                {tag}
                                                <X size={12} />
                                            </button>
                                        ))}
                                        <input
                                            placeholder={excludedIngredients.length === 0 ? "Nach Produkten suchen..." : "Weitere..."}
                                            value={exSearch}
                                            onChange={(e) => { setExSearch(e.target.value); setShowExSuggestions(true); }}
                                            onFocus={() => setShowExSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowExSuggestions(false), 200)}
                                            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm px-2 h-7"
                                        />
                                    </div>
                                    {showExSuggestions && exSuggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            {exSuggestions.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => { setExcludedIngredients(prev => [...prev, p.name]); setExSearch(''); }}
                                                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between group"
                                                >
                                                    {p.name}
                                                    <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                {!result ? (
                                    <Button
                                        onClick={spin}
                                        disabled={isSpinning || filteredPool.length === 0}
                                        className="flex-1 h-16 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
                                    >
                                        {isSpinning ? <Loader2 className="animate-spin mr-2" /> : <Play size={20} className="mr-2 fill-current" />}
                                        AUF GUT GLÜCK!
                                    </Button>
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={spin} className="h-16 px-6 rounded-2xl border-2">
                                            <Play size={20} />
                                        </Button>
                                        <Button
                                            onClick={() => onSelect(result)}
                                            className="flex-1 h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                        >
                                            <Calendar size={20} className="mr-2" />
                                            REZEPT EINPLANEN
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
