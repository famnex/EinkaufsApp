import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Sparkles, Zap, Shield, Crown, Info, Loader2, CreditCard } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import SubscriptionCancelModal from './SubscriptionCancelModal';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionModal({ isOpen, onClose, currentTier = 'Plastikgabel' }) {
    const { refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);
    const [view, setView] = useState('tiers'); // 'tiers' or 'payment'

    useEffect(() => {
        if (isOpen) {
            fetchStatus();
        }
    }, [isOpen]);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/subscription/status');
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch subscription status', err);
        }
    };

    const handleClose = () => {
        refreshUser();
        setView('tiers');
        onClose();
    };

    const handleCheckout = async (tierName) => {
        if (tierName === 'Plastikgabel') {
            refreshUser();
            onClose();
            return;
        }
        setSelectedTier(tierName);
        setView('payment');
    };

    const handleProcessPayment = async (provider) => {
        setLoading(true);
        try {
            if (provider === 'stripe') {
                const { data } = await api.post('/subscription/stripe/create-session', {
                    tier: selectedTier,
                    successUrl: window.location.origin + '/settings?payment=success',
                    cancelUrl: window.location.origin + '/settings?payment=cancel'
                });
                if (data.url) window.location.href = data.url;
            } else if (provider === 'paypal') {
                // Placeholder for PayPal
                alert('PayPal Integration folgt in Kürze. Bitte nutzen Sie vorerst Kartenzahlung.');
            }
        } catch (err) {
            alert('Checkout failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const tiers = [
        {
            name: 'Plastikgabel',
            price: 'Free',
            icon: Zap,
            color: 'text-muted-foreground',
            bg: 'bg-muted/10',
            features: [
                'Basis-Einkaufsliste mit Import- und Produktwechselfunktion (KI)',
                'Rezeptverwaltung, Menüverwaltung, Kochmodus',
                '(i) Kaum KI-Funktionen'
            ],
            buttonText: 'Plan wählen',
            popular: false
        },
        {
            name: 'Silbergabel',
            price: '1.99€',
            period: '/ Monat',
            icon: Shield,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            features: [
                'Alle AI-Features freigeschaltet*',
                '600 Coins monatlich inklusive',
                'Rezeptgenerierung und KI-Rezeptimport',
                'KI Kochassistent, KI Bilderassistent',
                'Alexa-Integration',
                'Gemeinsamen Haushalt bilden'
            ],
            buttonText: 'Zahlungspflichtig bestellen',
            popular: true
        },
        {
            name: 'Goldgabel',
            price: '3.99€',
            period: '/ Monat',
            icon: Crown,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            features: [
                'Unlimitierte Text-AI (0 Coins)',
                'Günstigere Bildgenerierung',
                '1500 Coins monatlich inklusive',
                'Frühzeitiger Zugriff auf neue Features'
            ],
            buttonText: 'Zahlungspflichtig bestellen',
            popular: false
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="relative w-full max-w-5xl bg-background rounded-[2.5rem] shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">GabelGuru Premium</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {view === 'tiers' ? 'Wähle das perfekte Abo für dein Kocherlebnis' : `Zahlungsart für ${selectedTier} wählen`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-3 hover:bg-muted rounded-2xl transition-all hover:rotate-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 pt-4">
                            {view === 'tiers' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {tiers.map((tier) => {
                                        const isCurrent = currentTier === tier.name;
                                        const isGold = currentTier === 'Goldgabel';
                                        const isSilber = currentTier === 'Silbergabel';
                                        const isRainbow = currentTier === 'Rainbowspoon';

                                        // Button visibility logic
                                        let shouldShowButton = false;
                                        if (isRainbow) {
                                            shouldShowButton = false;
                                        } else if (tier.name === 'Plastikgabel') {
                                            shouldShowButton = isCurrent;
                                        } else if (tier.name === 'Silbergabel') {
                                            shouldShowButton = isCurrent || !isGold;
                                        } else if (tier.name === 'Goldgabel') {
                                            shouldShowButton = isCurrent || !isGold;
                                        }

                                        const Icon = tier.icon;

                                        return (
                                            <Card
                                                key={tier.name}
                                                className={cn(
                                                    "relative p-8 flex flex-col items-center text-center transition-all duration-500 border-2",
                                                    tier.popular ? "border-primary/50 shadow-2xl shadow-primary/10" : "border-border",
                                                    isCurrent && "border-emerald-500/50 bg-emerald-500/5"
                                                )}
                                            >
                                                {tier.popular && (
                                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                                                        Beliebteste Wahl
                                                    </div>
                                                )}

                                                <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-inner", tier.bg)}>
                                                    <Icon className={cn("w-10 h-10", tier.color)} />
                                                </div>

                                                <h3 className="text-xl font-black mb-2">{tier.name}</h3>
                                                <div className="flex items-baseline gap-1 mb-8">
                                                    <span className="text-4xl font-black">{tier.price}</span>
                                                    {tier.period && <span className="text-muted-foreground text-sm font-medium">{tier.period}</span>}
                                                </div>

                                                <div className="w-full space-y-4 mb-10 text-left">
                                                    {tier.features.map((feat, i) => {
                                                        const isInfo = feat.startsWith('(i)');
                                                        const displayFeat = isInfo ? feat.replace('(i) ', '') : feat;

                                                        return (
                                                            <div key={i} className="flex items-start gap-3 group">
                                                                <div className={cn(
                                                                    "mt-1 w-5 h-5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform",
                                                                    isInfo ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary"
                                                                )}>
                                                                    {isInfo ? <Info size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={4} />}
                                                                </div>
                                                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{displayFeat}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-auto w-full">
                                                    {shouldShowButton && (
                                                        <Button
                                                            variant={tier.popular ? "primary" : "outline"}
                                                            className={cn(
                                                                "w-full h-14 rounded-2xl gap-2 text-sm",
                                                                isCurrent && "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                                            )}
                                                            onClick={() => handleCheckout(tier.name)}
                                                            disabled={loading || isCurrent}
                                                        >
                                                            {loading ? <Loader2 className="animate-spin" size={20} /> : (isCurrent ? 'Dein Plan' : tier.buttonText)}
                                                            {!isCurrent && <ArrowRight size={18} />}
                                                        </Button>
                                                    )}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="max-w-2xl mx-auto py-10">
                                    <Button
                                        variant="ghost"
                                        className="mb-8 gap-2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setView('tiers')}
                                    >
                                        <ArrowRight size={18} className="rotate-180" />
                                        Zurück zur Übersicht
                                    </Button>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Stripe Option */}
                                        <Card
                                            className="p-8 hover:border-primary/50 transition-all cursor-pointer group flex flex-col items-center text-center"
                                            onClick={() => handleProcessPayment('stripe')}
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6 group-hover:scale-110 transition-transform">
                                                <CreditCard size={32} />
                                            </div>
                                            <h3 className="text-lg font-black mb-2">Kartenzahlung & CO</h3>
                                            <p className="text-xs text-muted-foreground mb-6">Kreditkarte, SEPA-Lastschrift, Apple Pay & Google Pay</p>
                                            <div className="flex items-center gap-2 mt-auto grayscale group-hover:grayscale-0 transition-all opacity-60">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-4" />
                                            </div>
                                        </Card>

                                        {/* PayPal Option */}
                                        <Card
                                            className="p-8 hover:border-blue-500/50 transition-all cursor-pointer group flex flex-col items-center text-center"
                                            onClick={() => handleProcessPayment('paypal')}
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                                                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                                                    <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.398a.641.641 0 01.632-.534H12.9c3.085 0 5.483.655 6.941 1.84 1.341 1.087 1.956 2.68 1.8 4.71-.341 4.545-3.056 7.034-7.447 7.034h-1.618a1.069 1.069 0 00-1.042.842l-.803 4.102a.641.641 0 01-.634.534l-.001.251zM19.103 4.41a.639.639 0 01-.632.533H12.9c-2.31 0-4.088.486-5.285 1.442-1.096.877-1.6 2.16-1.472 3.81.274 3.655 2.454 5.657 5.981 5.657h1.618c.83 0 1.547-.5 1.745-1.288l.842-4.296.08-.41a.641.641 0 01.632-.533h1.8c2.474 0 3.737-1.077 3.86-3.21.1-1.68-.415-2.864-1.536-3.71-.853-.642-2.126-.998-3.7-1.02a.64.64 0 01-.462.723z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-black mb-2">PayPal</h3>
                                            <p className="text-xs text-muted-foreground mb-6">Sicher zahlen mit deinem PayPal-Konto</p>
                                            <div className="mt-auto grayscale group-hover:grayscale-0 transition-all opacity-60">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-6" />
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Security Badge */}
                                    <div className="mt-10 flex items-center justify-center gap-3 text-muted-foreground">
                                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest border border-border px-3 py-1.5 rounded-full bg-muted/20">
                                            <Shield size={14} className="text-emerald-500" />
                                            Sicheres SSL-Zahlverfahren
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Info Section */}
                            {view === 'tiers' && (
                                <div className="mt-10 p-6 bg-muted/30 rounded-3xl border border-border flex flex-col md:flex-row items-center gap-6">
                                    <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                        <Info size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold mb-1">* Über das flexible Coin-System</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Coins werden nur für rechenintensive AI-Modelle (wie GPT-4o und DALL-E 3) benötigt.
                                            In den Premium-Plänen erhältst du ein monatliches Kontingent, das für die meisten Nutzer völlig ausreicht.
                                            Du kannst jederzeit zusätzliche Coins einzeln nachkaufen.
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="gap-2 pointer-events-none">
                                        <CreditCard size={18} />
                                        Zahlarten: PayPal | Stripe: SEPA-Lastschrift, Girocard, Kreditkarte
                                    </Button>
                                </div>
                            )}

                        </div>
                    </motion.div>
                </div>
            )}

            <SubscriptionCancelModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                currentTier={currentTier}
                onRefreshed={fetchStatus}
            />
        </AnimatePresence>
    );
}
