import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Sparkles, AlertCircle, HelpCircle, Flag } from 'lucide-react';
import ReportIssueModal from './ReportIssueModal';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';
import { useTutorial } from '../contexts/TutorialContext';

export default function ProductSubstituteModal({
    isOpen,
    onClose,
    originalProduct,
    suggestions,
    loading,
    onSelect,
    conflicts = [],
    allProducts = []
}) {
    const { notifyAction } = useTutorial();
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportContext, setReportContext] = useState(null);

    useEffect(() => {
        if (isOpen) {
            // Trigger a resize event so that driver.js recalculates the overlay 
            // after the modal's height has adjusted to the new suggestions
            const timeout = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 50);
            return () => clearTimeout(timeout);
        }
    }, [loading, suggestions, isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        id="product-substitute-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                                        <Sparkles className="text-primary" size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bebas tracking-wide text-foreground">
                                            Ersatz Vorschläge
                                        </h2>
                                        <p className="text-xs text-muted-foreground font-medium">
                                            Für: <span className="text-foreground font-bold">{originalProduct?.name}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-muted rounded-xl transition-colors"
                                >
                                    <X size={20} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <RefreshCw className="animate-spin text-primary" size={32} />
                                    <p className="text-sm text-muted-foreground font-medium">
                                        KI analysiert Alternativen...
                                    </p>
                                </div>
                            ) : suggestions.length > 0 ? (
                                <div className="space-y-3">
                                    {suggestions.map((suggestion, idx) => (
                                        <motion.button
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onClick={() => {
                                                onSelect(suggestion);
                                                notifyAction('substitute-selected');
                                            }}
                                            className={cn(
                                                "w-full text-left p-4 rounded-2xl border-2 transition-all group substitute-suggestion-item",
                                                "hover:border-primary hover:bg-primary/5",
                                                "border-border bg-card"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-base text-foreground truncate">
                                                            {suggestion.name}
                                                        </div>
                                                        {(() => {
                                                            const p = allProducts.find(ap => ap.name.toLowerCase() === suggestion.name.toLowerCase());
                                                            if (!p) return null;
                                                            const conflict = conflicts.find(c => Number(c.productId) === Number(p.id));
                                                            if (!conflict || !conflict.warnings || conflict.warnings.length === 0) return null;

                                                            const maxProb = conflict.warnings.reduce((max, w) => Math.max(max, w.probability || 0), 0);
                                                            if (maxProb <= 30) return null;

                                                            return maxProb >= 80 ? (
                                                                <AlertCircle size={16} className="text-destructive animate-pulse" />
                                                            ) : (
                                                                <HelpCircle size={16} className="text-orange-500" />
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {suggestion.reason}
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold text-primary shrink-0 flex flex-col items-end gap-2">
                                                    <span>{Math.round(suggestion.confidence * 100)}%</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const p = allProducts.find(ap => ap.name.toLowerCase() === suggestion.name.toLowerCase());
                                                            setReportContext({
                                                                productId: p?.id,
                                                                productName: suggestion.name,
                                                                additionalContext: `SubstituteModal: Ersatz für ${originalProduct?.name}`
                                                            });
                                                            setIsReportModalOpen(true);
                                                        }}
                                                        className="p-1.5 text-muted-foreground/30 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                                                        title="Fehrlerhaften Vorschlag melden"
                                                    >
                                                        <Flag size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-muted-foreground">
                                    Keine Vorschläge gefunden.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-border bg-muted/10">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="w-full rounded-xl"
                            >
                                Abbrechen
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            <ReportIssueModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                productContext={reportContext}
            />
        </>
    );
}
