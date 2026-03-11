import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { LogIn, ShoppingBag, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// ThemeToggle removed as it's in PublicLayout
import api from '../lib/axios';
import PublicLayout from '../components/PublicLayout';
import { cn } from '../lib/utils';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState('');
    const [regEnabled, setRegEnabled] = useState(true);
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from ? `${location.state.from.pathname}${location.state.from.search}` : '/';

    useEffect(() => {
        if (user) {
            navigate(from, { replace: true });
        }
    }, [user, navigate, from]);

    useEffect(() => {
        const checkReg = async () => {
            try {
                const { data } = await api.get('/auth/registration-status');
                if (data.setupRequired) {
                    navigate('/signup?setup=true');
                    return;
                }
                setRegEnabled(data.enabled);
            } catch (err) {
                console.error('Failed to check reg status', err);
            }
        };
        checkReg();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResendSuccess('');
        setIsLoading(true);
        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Login error:', err.response?.data);
            setError(err.response?.data?.error || 'Anmeldung fehlgeschlagen. Bitte überprüfe deine Zugangsdaten.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!email) {
            setError('Bitte gib deine E-Mail-Adresse ein.');
            return;
        }
        setResendLoading(true);
        setError('');
        try {
            const { data } = await api.post('/auth/resend-verification', { email });
            setResendSuccess(data.message);
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Senden der Bestätigungs-E-Mail.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <PublicLayout mainClassName="pt-16 sm:pt-24 pb-8 sm:pb-12 flex flex-col items-center justify-center min-h-[80vh]">
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden transition-colors duration-300">
                {/* Background Glows */}
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/5 dark:bg-secondary/10 rounded-full blur-[150px]" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-md relative z-10 mx-auto"
                >
                    <Card className="p-5 sm:p-8 lg:p-10 border-border shadow-2xl bg-card/50 backdrop-blur-xl">
                        {/* Header: 2-col on mobile (logo | text), centered column on sm+ */}
                        <div className="mb-3 sm:mb-8 flex items-center gap-3 sm:flex-col sm:items-center sm:gap-0">
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="shrink-0 w-1/4 sm:w-auto flex justify-center sm:mb-5 rounded-2xl bg-white dark:bg-card p-2.5 sm:p-4 shadow-lg shadow-black/5 transform hover:scale-110 transition-transform duration-500 overflow-hidden"
                            >
                                <img
                                    src={`${import.meta.env.BASE_URL}icon-512x512.png`}
                                    alt="GabelGuru Logo"
                                    className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                                <div style={{ display: 'none' }} className="text-primary">
                                    <ShoppingBag size={26} className="sm:w-8 sm:h-8" />
                                </div>
                            </motion.div>
                            <div className="flex-1 sm:text-center">
                                <motion.h1
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-xl sm:text-3xl font-bold text-foreground tracking-tight mb-0.5 sm:mb-2"
                                >
                                    Willkommen zurück
                                </motion.h1>
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-xs sm:text-sm text-muted-foreground sm:text-center"
                                >
                                    Gib deine Daten ein, um auf <span className="text-foreground font-semibold">GabelGuru</span> zuzugreifen
                                </motion.p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-2"
                            >
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="deine@email.de"
                                    required
                                    className="bg-background/50 border-border h-12"
                                />
                            </motion.div>
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="space-y-2"
                            >
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Passwort</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-background/50 border-border h-12"
                                />
                                <div className="flex justify-end mt-1">
                                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                                        Passwort vergessen?
                                    </Link>
                                </div>
                            </motion.div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "p-4 rounded-xl border flex flex-col gap-2",
                                        error === 'Unverifiziert'
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500"
                                            : "bg-destructive/10 border-destructive/20 text-destructive text-xs"
                                    )}
                                >
                                    {error === 'Unverifiziert' ? (
                                        <>
                                            <div className="flex items-center gap-2 font-bold text-sm">
                                                <Mail size={16} /> E-Mail bestätigen
                                            </div>
                                            <p className="text-xs leading-relaxed">
                                                Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Bestätigungslink gesendet.
                                                Schau bitte auch in deinen <span className="font-bold underline">Spam-Ordner</span>.
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="mt-2 w-fit bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-2 h-9"
                                                onClick={handleResendVerification}
                                                disabled={resendLoading}
                                            >
                                                {resendLoading ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                                                Link erneut senden
                                            </Button>
                                        </>
                                    ) : (
                                        error
                                    )}
                                </motion.div>
                            )}

                            <AnimatePresence>
                                {resendSuccess && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500 text-xs flex flex-col gap-2"
                                    >
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                            <CheckCircle2 size={16} /> Gesendet!
                                        </div>
                                        <p>{resendSuccess}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                <Button type="submit" className="w-full mt-4" size="lg" disabled={isLoading}>
                                    {isLoading ? 'Authentifizierung...' : 'Anmelden'}
                                </Button>
                            </motion.div>
                        </form>

                        {regEnabled && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.9 }}
                                className="mt-6 sm:mt-10 text-center text-sm"
                            >
                                <span className="text-muted-foreground tracking-wide">Neu hier?</span>{' '}
                                <Link to="/signup" className="font-bold text-primary hover:text-primary/80 transition-colors ml-1 underline decoration-primary/30 underline-offset-4">
                                    Konto erstellen
                                </Link>
                            </motion.div>
                        )}
                    </Card>
                </motion.div>
            </div>
        </PublicLayout>
    );
}
