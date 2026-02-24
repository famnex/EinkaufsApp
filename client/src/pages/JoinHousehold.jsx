import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Home } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function JoinHousehold() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(false);
    const [terminating, setTerminating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [inviterName, setInviterName] = useState('...');

    const isSubscribed = user?.tier !== 'Plastikgabel' && user?.tier !== 'Rainbowspoon';

    useEffect(() => {
        if (!token) {
            setError('Ungültiger oder fehlender Einladungs-Link.');
            return;
        }

        const fetchInviteInfo = async () => {
            try {
                const { data } = await api.get(`/auth/household/info?token=${token}`);
                setInviterName(data.inviterName);

                // Check if user is already in this household
                const targetHouseholdId = data.householdId;
                const currentHouseholdId = user?.householdId || user?.id;

                if (currentHouseholdId === targetHouseholdId) {
                    setError('Dies ist dein eigener Haushalt oder du bist bereits Mitglied dieses Haushalts.');
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Fehler beim Laden der Einladung.');
            }
        };

        fetchInviteInfo();
    }, [token, user]);

    const handleJoin = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post('/auth/household/join', { token });
            setSuccess(true);
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Beitreten des Haushalts.');
        } finally {
            setLoading(false);
        }
    };

    const handleTerminateAndJoin = async () => {
        if (!window.confirm('Möchtest du dein Abo wirklich sofort beenden? Dein aktueller Zeitraum verfällt dabei sofort.')) return;

        setTerminating(true);
        setError(null);
        try {
            await api.post('/subscription/terminate');
            await handleJoin();
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Beenden des Abos.');
            setTerminating(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center space-y-6"
                >
                    <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} />
                    </div>
                    <h1 className="text-3xl font-bold">Willkommen zu Hause!</h1>
                    <p className="text-muted-foreground">
                        Du bist erfolgreich dem Haushalt beigetreten. Alle eure Daten wurden zusammengeführt.
                    </p>
                    <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={() => navigate('/')}
                    >
                        Zum Dashboard <ArrowRight size={20} />
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <Card className="max-w-md w-full p-8 space-y-8 shadow-2xl border-primary/20 bg-card/50 backdrop-blur-xl">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                        <Users size={32} />
                    </div>
                    <h1 className="text-2xl font-bold">Haushalt beitreten</h1>
                    <p className="text-sm text-muted-foreground">
                        <span className="font-bold text-foreground">{inviterName}</span> lädt dich ein, einem gemeinsamen Haushalt beizutreten.
                    </p>
                </div>

                {error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm flex gap-3">
                        <AlertTriangle className="shrink-0" />
                        <p>{error}</p>
                    </div>
                ) : isSubscribed ? (
                    <div className="space-y-6">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                            <h3 className="font-bold text-amber-600 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <AlertTriangle size={16} /> Abo-Konflikt
                            </h3>
                            <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                Du hast ein aktives <strong>{user.tier}</strong> Abo. Um einem Haushalt beizutreten, darf kein Abo bestehen, da die Abrechnung sonst kollidiert.
                            </p>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-amber-800/60 uppercase">Option 1: Später beitreten</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/10 h-10"
                                        onClick={() => navigate('/settings?tab=subscription')}
                                    >
                                        Abo kündigen & auslaufen lassen
                                    </Button>
                                    <p className="text-[9px] text-amber-600/70 italic px-1">
                                        Du kannst dein Abo in den Einstellungen kündigen. Sobald es abgelaufen ist, kannst du über diesen Link beitreten.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-amber-800/60 uppercase">Option 2: Sofort beitreten</p>
                                    <Button
                                        size="lg"
                                        className="w-full h-12 text-sm font-bold shadow-lg shadow-primary/20"
                                        onClick={handleTerminateAndJoin}
                                        disabled={terminating}
                                    >
                                        {terminating ? <Loader2 className="animate-spin" /> : 'Abo sofort beenden & Beitreten'}
                                    </Button>
                                    <p className="text-[9px] text-amber-600/70 italic px-1">
                                        Achtung: Dein aktuelles Abo wird sofort beendet. Bezahlte Zeiträume verfallen dabei.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => navigate('/')}
                            disabled={terminating}
                        >
                            Abbrechen
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                            <h3 className="font-bold text-amber-600 flex items-center gap-2 text-sm">
                                <AlertTriangle size={16} /> WICHTIGER HINWEIS
                            </h3>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Beim Beitreten werden <strong>alle deine Daten</strong> (Rezepte, Produkte, Einkaufslisten)
                                mit den Daten des Haushalts <strong>zusammengeführt</strong>.
                                Dies kann nicht rückgängig gemacht werden.
                            </p>
                            <p className="text-[10px] text-amber-600/70 italic">
                                Tipp: Prüfe danach Rezepte und Produkte auf eventuelle Duplikate.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button
                                size="lg"
                                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
                                onClick={handleJoin}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Jetzt beitreten & Daten mergen'}
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full text-muted-foreground"
                                onClick={() => navigate('/')}
                                disabled={loading}
                            >
                                Abbrechen
                            </Button>
                        </div>
                    </div>
                )}

                <div className="text-center pt-4 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        GabelGuru Haushalt-System
                    </p>
                </div>
            </Card>
        </div>
    );
}
