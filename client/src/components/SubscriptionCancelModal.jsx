import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ArrowRight, Shield, Zap, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionCancelModal({ isOpen, onClose, currentTier, onRefreshed }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('choice'); // 'choice', 'confirm'

    const isCanceled = user?.cancelAtPeriodEnd;

    const handleDowngrade = async () => {
        setLoading(true);
        try {
            await api.post('/subscription/downgrade', { toTier: 'Silbergabel' });
            alert('Dein Abo wurde zum Ende der Laufzeit auf Silbergabel umgestellt.');
            onRefreshed();
            onClose();
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        setLoading(true);
        try {
            await api.post('/subscription/cancel');
            alert('Dein Abo wurde zum Ende der Laufzeit gekündigt.');
            onRefreshed();
            onClose();
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleReactivate = async () => {
        setLoading(true);
        try {
            await api.post('/subscription/reactivate');
            alert('Dein Abo wurde erfolgreich reaktiviert!');
            onRefreshed();
            onClose();
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div key="cancel-modal-overlay" className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        key="cancel-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        key="cancel-modal-content"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="relative w-full max-w-lg bg-background rounded-[2rem] shadow-2xl overflow-hidden border border-border"
                    >
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black">{isCanceled ? 'Abo reaktivieren' : 'Abo verwalten'}</h3>
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {isCanceled ? (
                                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl mb-8 flex gap-4">
                                    <RefreshCw className="text-primary shrink-0 transition-all" size={24} />
                                    <div className="text-sm">
                                        <p className="font-bold text-primary mb-1">Abo läuft aktuell aus</p>
                                        <p className="text-muted-foreground leading-snug">
                                            Dein Abo endet am {user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('de-DE') : 'Ende der Laufzeit'}. Du kannst es jetzt reaktivieren, um alle Vorteile ohne Unterbrechung weiter zu nutzen.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-8 flex gap-4">
                                    <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                                    <div className="text-sm">
                                        <p className="font-bold text-amber-500 mb-1">Wichtiger Hinweis</p>
                                        <p className="text-muted-foreground leading-snug">
                                            Bei einer Kündigung oder einem Downgrade zu Plastikgabel verfallen alle restlichen Coins unwiderruflich zum Ende des aktuellen Abrechnungszeitraums! Zudem werden bestehende Haushalte aufgelöst.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {isCanceled ? (
                                    <Card
                                        onClick={handleReactivate}
                                        className="p-6 border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                                                <RefreshCw size={32} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-black">Abo reaktivieren</p>
                                                <p className="text-sm text-muted-foreground">Kündigung zurücknehmen und Abo wie gewohnt weiterführen.</p>
                                            </div>
                                            <ArrowRight size={20} className="text-primary group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </Card>
                                ) : (
                                    <>
                                        {currentTier === 'Goldgabel' && (
                                            <Card
                                                onClick={handleDowngrade}
                                                className="p-4 border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                                                        <Shield size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold">Downgrade zu Silber</p>
                                                        <p className="text-xs text-muted-foreground">Wechsle am Ende der Laufzeit zu Silbergabel (1.99€/Monat)</p>
                                                    </div>
                                                    <ArrowRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            </Card>
                                        )}

                                        <Card
                                            onClick={handleCancel}
                                            className="p-4 border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-destructive/10 rounded-xl text-destructive group-hover:scale-110 transition-transform">
                                                    <Zap size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold">Abo kündigen</p>
                                                    <p className="text-xs text-muted-foreground">Zurück zur kostenlosen Plastikgabel (Keine Kosten mehr)</p>
                                                </div>
                                                <ArrowRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </Card>
                                    </>
                                )}
                            </div>

                            {loading && (
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="animate-spin text-primary" size={40} />
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="w-full mt-6"
                            >
                                {isCanceled ? 'Schließen' : 'Doch nicht kündigen'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
