import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import api from '../lib/axios';

export default function ReportIssueModal({ isOpen, onClose, productContext = {} }) {
    const [issueType, setIssueType] = useState('unverstraeglichkeit');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!isOpen && !success) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/feedback/report-issue', {
                productId: productContext.productId,
                productName: productContext.productName,
                variationId: productContext.variationId,
                issueType,
                description,
                context: productContext.additionalContext || 'ItemSettingsModal'
            });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setDescription('');
                onClose();
            }, 3000);
        } catch (err) {
            console.error('Failed to report issue:', err);
            alert('Meldung konnte nicht gesendet werden. Bitte versuche es später erneut.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-full max-w-md relative z-10"
                    >
                        <Card className="p-6 border-border shadow-2xl bg-card overflow-hidden">
                            {success ? (
                                <div className="py-12 flex flex-col items-center text-center space-y-4 relative">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-xl"
                                    >
                                        <X size={20} />
                                    </button>
                                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Vielen Dank!</h2>
                                        <p className="text-muted-foreground text-sm mt-2">Deine Meldung wurde erfolgreich übermittelt. Wir prüfen das Produkt.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                <AlertTriangle size={20} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold">Fehler melden</h2>
                                                <p className="text-xs text-muted-foreground font-medium">Produkt: <span className="text-foreground">{productContext.productName}</span></p>
                                            </div>
                                        </div>
                                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-xl">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Was stimmt nicht?</label>
                                            <select
                                                value={issueType}
                                                onChange={(e) => setIssueType(e.target.value)}
                                                className="w-full h-12 px-4 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none appearance-none font-medium text-sm"
                                            >
                                                <option value="unverstraeglichkeit">Falsche Unverträglichkeit</option>
                                                <option value="einheit">Falsche Einheit / Menge</option>
                                                <option value="rechtschreibung">Rechtschreibfehler</option>
                                                <option value="variante">Fehlende Variante</option>
                                                <option value="produkt">Anderer Produktfehler</option>
                                                <option value="sonstiges">Sonstiges Feedback</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Beschreibung</label>
                                            <div className="relative">
                                                <textarea
                                                    required
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="Beschreibe kurz was falsch ist..."
                                                    className="w-full min-h-[120px] p-4 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm resize-none"
                                                />
                                                <MessageSquare className="absolute right-4 bottom-4 text-muted-foreground/30" size={16} />
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full h-14 rounded-2xl gap-2 text-base font-bold shadow-lg shadow-primary/20"
                                        >
                                            {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><X size={18} /></motion.div> : <Send size={18} />}
                                            Meldung absenden
                                        </Button>
                                    </form>
                                </>
                            )}
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
