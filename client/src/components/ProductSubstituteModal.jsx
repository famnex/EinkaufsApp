import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';

export default function ProductSubstituteModal({
    isOpen,
    onClose,
    originalProduct,
    suggestions,
    loading,
    onSelect
}) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
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
                                        onClick={() => onSelect(suggestion)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border-2 transition-all group",
                                            "hover:border-primary hover:bg-primary/5",
                                            "border-border bg-card"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-base text-foreground truncate">
                                                    {suggestion.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {suggestion.reason}
                                                </div>
                                            </div>
                                            <div className="text-xs font-bold text-primary shrink-0">
                                                {Math.round(suggestion.confidence * 100)}%
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
    );
}
