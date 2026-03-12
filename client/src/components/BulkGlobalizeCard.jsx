import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, RefreshCw, X, AlertCircle, Info, Tag, ExternalLink, Globe, Plus, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function BulkGlobalizeCard({ product, onComplete, globalProducts = [], allIntolerances = [], allVariants = [] }) {
    const [status, setStatus] = useState('loading'); // 'loading', 'review', 'error', 'merging', 'globalizing', 'refining'
    const [suggestions, setSuggestions] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null); // { id, name }
    const [analysisData, setAnalysisData] = useState(null); // AI property analysis
    const [intoleranceIds, setIntoleranceIds] = useState([]);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [usage, setUsage] = useState({ usageCount: 0, recipes: [] });
    const [error, setError] = useState(null);

    const fetchAnalysis = async (userFeedback = '') => {
        setStatus(userFeedback ? 'refining' : 'loading');
        setError(null);
        try {
            // 1. Get Usage
            // 2. Get AI Match suggestions
            // 3. Get AI Property Analysis (like Cleanup)
            const [usageRes, matchRes, analysisRes] = await Promise.all([
                api.get(`/products/${product.id}/usage`),
                api.post('/ai/analyze-match', { 
                    productName: product.name,
                    globalProducts: globalProducts.map(p => ({ id: p.id, name: p.name }))
                }),
                api.post('/ai/analyze-product', {
                    productName: product.name,
                    userFeedback: userFeedback || undefined
                })
            ]);

            setUsage(usageRes.data);
            setSuggestions(matchRes.data.matches || []);
            setAnalysisData(analysisRes.data);
            setIntoleranceIds(analysisRes.data.intoleranceIds || []);
            
            // Auto-select if high confidence match found
            const topMatch = matchRes.data.matches?.[0];
            if (topMatch && topMatch.confidence > 90) {
                setSelectedMatch({ id: topMatch.id, name: topMatch.name });
            }

            setStatus('review');
            setShowFeedback(false);
            setFeedback('');
        } catch (err) {
            console.error('Analysis failed:', err);
            setError(err.response?.data?.error || err.message);
            setStatus('error');
        }
    };

    useEffect(() => {
        fetchAnalysis();
    }, [product.id]);

    const handleMerge = async () => {
        if (!selectedMatch) return;
        try {
            setStatus('merging');
            await api.post('/products/merge', {
                sourceId: product.id,
                targetId: selectedMatch.id
            });
            onComplete(product.id, 'merged');
        } catch (err) {
            console.error('Merge failed:', err);
            setError('Zusammenführung fehlgeschlagen');
            setStatus('review');
        }
    };

    const handleGlobalize = async () => {
        if (!analysisData) return;
        try {
            setStatus('globalizing');
            
            let finalCategory = analysisData.category;
            let finalUnit = analysisData.unit;
            let finalVariations = analysisData.hasVariants ? analysisData.variants : null;

            // Promotion logic: if only one variant, promote it to standard fields
            if (analysisData.hasVariants && analysisData.variants.length === 1) {
                finalCategory = analysisData.variants[0].category;
                finalUnit = analysisData.variants[0].unit;
                finalVariations = null;
            }

            // Filter the AI intolerances (which have probabilities) to match the user's remaining IDs
            const filteredIntolerances = (analysisData.intolerances || []).filter(i =>
                intoleranceIds.includes(i.id)
            );

            await api.post(`/products/${product.id}/globalize`, {
                name: product.name,
                category: finalCategory,
                unit: finalUnit,
                intolerances: filteredIntolerances,
                variations: finalVariations,
                synonyms: []
            });
            onComplete(product.id, 'globalized');
        } catch (err) {
            console.error('Globalization failed:', err);
            setError('Globalisierung fehlgeschlagen');
            setStatus('review');
        }
    };

    const handleIgnore = async () => {
        try {
            setStatus('refining'); // Show loading state
            await api.put(`/products/${product.id}/ignore-globalization`);
            onComplete(product.id, 'ignored');
        } catch (err) {
            console.error('Ignore failed:', err);
            setError('Ignorieren fehlgeschlagen');
            setStatus('review');
        }
    };

    const handleRefine = () => {
        if (!feedback.trim()) return;
        fetchAnalysis(feedback);
    };

    return (
        <Card className="flex flex-col h-full bg-card border-border overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300">
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <h3 className="font-bold text-lg truncate flex-1" title={product.name}>
                    {product.name}
                </h3>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full font-bold uppercase tracking-wider border border-blue-500/20">
                        Inbox
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Dieses Produkt dauerhaft von der Globalisierung ausschließen?')) {
                                handleIgnore();
                            }
                        }}
                        className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                        title="Produkte ignorieren (nicht globalisieren)"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 relative min-h-[200px]">
                <AnimatePresence mode="wait">
                    {(status === 'loading' || status === 'merging' || status === 'globalizing' || status === 'refining') && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-[2px] z-10"
                        >
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                            <p className="text-xs font-medium text-muted-foreground text-center px-4">
                                {status === 'loading' ? 'KI analysiert Produkt & sucht Matches...' : 
                                 status === 'merging' ? 'Zusammenführung läuft...' :
                                 status === 'globalizing' ? 'Neues Produkt wird angelegt...' :
                                 'KI optimiert Vorschlag...'}
                            </p>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center text-center p-4"
                        >
                            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                            <p className="text-sm font-medium text-destructive mb-4">{error}</p>
                            <Button size="sm" variant="outline" onClick={fetchAnalysis}>
                                Erneut versuchen
                            </Button>
                        </motion.div>
                    )}

                    {status === 'review' && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            {/* Usage section */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Info size={10} /> In Rezepten
                                </div>
                                <div className="space-y-1.5">
                                    {usage.usageCount > 0 ? (
                                        usage.recipes.map(recipe => (
                                            <a 
                                                key={recipe.id}
                                                href={`/admin/recipe-view/${recipe.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-2 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 text-xs transition-colors group/link"
                                            >
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="font-medium truncate">{recipe.title}</span>
                                                    {recipe.owner && (
                                                        <span className="text-[9px] text-muted-foreground truncate italic">von {recipe.owner}</span>
                                                    )}
                                                </div>
                                                <ExternalLink size={12} className="text-muted-foreground group-hover/link:text-primary shrink-0 ml-2" />
                                            </a>
                                        ))
                                    ) : (
                                        <div className="text-[11px] p-2 bg-muted/30 rounded-lg text-muted-foreground italic border border-border/50 text-center">
                                            Wird noch nicht verwendet
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* Suggestions / Selection */}
                             <div className="space-y-2">
                                 <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                     <Globe size={10} /> Globales Match
                                 </div>
                                 
                                 <div className="space-y-2">
                                     {suggestions.length > 0 ? (
                                         <div className="space-y-1.5">
                                             {suggestions.map(match => (
                                                 <button
                                                     key={match.id}
                                                     onClick={() => {
                                                         if (selectedMatch?.id === match.id) setSelectedMatch(null);
                                                         else setSelectedMatch({ id: match.id, name: match.name });
                                                     }}
                                                     className={cn(
                                                         "w-full text-left p-2.5 rounded-xl border transition-all relative overflow-hidden group/match",
                                                         selectedMatch?.id === match.id 
                                                             ? "bg-primary/10 border-primary shadow-sm" 
                                                             : "bg-card border-border hover:border-primary/40"
                                                     )}
                                                 >
                                                     <div className="flex items-center justify-between">
                                                         <div className="flex flex-col min-w-0">
                                                             <span className="text-xs font-bold truncate">{match.name}</span>
                                                             <span className="text-[10px] text-muted-foreground truncate">{match.reason}</span>
                                                         </div>
                                                         <div className="flex items-center gap-2 shrink-0">
                                                             <span className={cn(
                                                                 "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                                                 match.confidence > 80 ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"
                                                             )}>
                                                                 {match.confidence}%
                                                             </span>
                                                             {selectedMatch?.id === match.id && (
                                                                 <Check size={14} className="text-primary animate-in zoom-in" />
                                                             )}
                                                         </div>
                                                     </div>
                                                 </button>
                                             ))}
                                         </div>
                                     ) : (
                                         <div className="text-[10px] text-muted-foreground italic p-2 bg-muted/20 rounded-lg border border-dashed border-border text-center">
                                             Keine eindeutigen Matches gefunden
                                         </div>
                                     )}
 
                                     {/* Manual selection fallback */}
                                     <div className="pt-1">
                                         <select
                                             className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                                             onChange={(e) => {
                                                 const id = Number(e.target.value);
                                                 const name = e.target.options[e.target.selectedIndex].text;
                                                 setSelectedMatch({ id, name });
                                             }}
                                             value={selectedMatch?.id || ""}
                                         >
                                             <option value="" disabled>Anderes globales Produkt wählen...</option>
                                             {globalProducts
                                                 .filter(gp => !suggestions.some(s => s.id === gp.id))
                                                 .map(gp => (
                                                     <option key={gp.id} value={gp.id}>{gp.name}</option>
                                                 ))
                                             }
                                         </select>
                                     </div>
                                 </div>
                             </div>
 
                             {/* AI Property Suggestions (New - Like AI Cleanup) */}
                             {analysisData && (
                                 <div className="space-y-4 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                                     <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                         <Sparkles size={10} className="text-blue-500" /> {selectedMatch ? 'Vorschlag für NEU anlegen' : 'Eigenschaften Vorschlag (KI)'}
                                     </div>
 
                                     {/* Category & Unit */}
                                     {!analysisData.hasVariants && (
                                         <div className="grid grid-cols-2 gap-2">
                                             <div className="space-y-0.5">
                                                 <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Kategorie</span>
                                                 <div className="text-[11px] font-medium bg-muted/50 p-1.5 rounded-lg border border-border/50 truncate">
                                                     {analysisData.category}
                                                 </div>
                                             </div>
                                             <div className="space-y-0.5">
                                                 <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Einheit</span>
                                                 <div className="text-[11px] font-medium bg-muted/50 p-1.5 rounded-lg border border-border/50 truncate">
                                                     {analysisData.unit}
                                                 </div>
                                             </div>
                                         </div>
                                     )}
 
                                     {/* Intolerances */}
                                     <div className="space-y-1">
                                         <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight px-1">Unverträglichkeiten</span>
                                         <div className="flex flex-wrap gap-1">
                                             {intoleranceIds.length > 0 ? (
                                                 intoleranceIds.map(id => {
                                                     const intolerance = allIntolerances.find(i => i.id === id);
                                                     const label = intolerance?.warningText || intolerance?.name || `ID: ${id}`;
                                                     return (
                                                         <span
                                                             key={id}
                                                             className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-primary/5 text-primary rounded-full border border-primary/10"
                                                         >
                                                             {label}
                                                             <button
                                                                 onClick={() => setIntoleranceIds(prev => prev.filter(i => i !== id))}
                                                                 className="hover:text-destructive transition-colors"
                                                             >
                                                                 <X size={8} />
                                                             </button>
                                                         </span>
                                                     );
                                                 })
                                             ) : (
                                                 <span className="text-[10px] text-muted-foreground italic px-1">Keine erkannt</span>
                                             )}
                                         </div>
                                     </div>
 
                                     {/* Variants (Compact) */}
                                     {analysisData.hasVariants && analysisData.variants?.length > 0 && (
                                         <div className="space-y-1">
                                             <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight px-1 text-primary">Varianten erkannt</span>
                                             <div className="flex flex-wrap gap-1">
                                                 {analysisData.variants.map((v, idx) => (
                                                     <div key={idx} className="flex items-center gap-1 text-[9px] bg-muted/50 px-1.5 py-0.5 rounded border border-border/50 group/var">
                                                          <span>{allVariants.find(av => av.id === v.ProductVariantId)?.title || `V:${v.ProductVariantId}`}</span>
                                                          <button
                                                              onClick={() => {
                                                                  const filtered = analysisData.variants.filter((_, i) => i !== idx);
                                                                  setAnalysisData({
                                                                      ...analysisData,
                                                                      variants: filtered,
                                                                      hasVariants: filtered.length > 0
                                                                  });
                                                              }}
                                                              className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                                          >
                                                              <X size={8} />
                                                          </button>
                                                      </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}
 
                                     <Button 
                                         variant="ghost" 
                                         size="sm" 
                                         className="w-full h-7 text-[10px] text-primary hover:bg-primary/5 gap-1.5"
                                         onClick={() => setShowFeedback(true)}
                                     >
                                         <RefreshCw size={10} /> Korrektur wünschen
                                     </Button>
                                 </div>
                             )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-muted/30 border-t border-border mt-auto flex flex-col gap-3">
                <AnimatePresence>
                    {showFeedback && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-2 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                                <div className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                    <RefreshCw size={10} /> Korrektur
                                </div>
                                <input
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                    placeholder="z.B. 'Einheit ist ml', 'Ganzes Produkt'"
                                    className="w-full text-[10px] bg-background border border-primary/10 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
                                    autoFocus
                                />
                                <div className="flex gap-1">
                                    <Button size="sm" className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider" onClick={handleRefine}>
                                        Anpassen
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setShowFeedback(false)}>
                                        <X size={12} />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-2">
                    <Button
                        size="sm"
                        className="h-9 gap-1.5 font-bold text-[11px] uppercase tracking-wider"
                        onClick={handleMerge}
                        disabled={status !== 'review' || !selectedMatch}
                    >
                        <RefreshCw size={14} /> Zusammenführen
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5 font-bold text-[11px] uppercase tracking-wider"
                        onClick={handleGlobalize}
                        disabled={status !== 'review'}
                    >
                        <Check size={14} /> Neu anlegen
                    </Button>
                </div>
            </div>
        </Card>
    );
}
