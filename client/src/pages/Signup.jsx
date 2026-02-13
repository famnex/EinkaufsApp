import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ShieldCheck, Mail, Check, ArrowRight, ArrowLeft } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import PublicLayout from '../components/PublicLayout';
import axios from '../lib/axios';

export default function SignupPage() {
    // Form State
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // UI State
    const [step, setStep] = useState('register'); // 'register' | 'legal'
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Legal & Newsletter
    const [termsContent, setTermsContent] = useState('');
    const [privacyContent, setPrivacyContent] = useState('');
    const [loadingLegal, setLoadingLegal] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const from = location.state?.from ? `${location.state.from.pathname}${location.state.from.search}` : '/';

    const isSetup = searchParams.get('setup') === 'true';

    // Fetch legal texts when entering the legal step
    useEffect(() => {
        if (step === 'legal') {
            const fetchLegal = async () => {
                setLoadingLegal(true);
                try {
                    const [termsRes, privacyRes] = await Promise.all([
                        axios.get('/settings/legal/terms'),
                        axios.get('/settings/legal/privacy')
                    ]);
                    setTermsContent(termsRes.data.value || '<p>Keine Nutzungsbedingungen hinterlegt.</p>');
                    setPrivacyContent(privacyRes.data.value || '<p>Keine Datenschutzerklärung hinterlegt.</p>');
                } catch (err) {
                    console.error("Failed to fetch legal texts", err);
                    setTermsContent('<p>Fehler beim Laden der Nutzungsbedingungen.</p>');
                    setPrivacyContent('<p>Fehler beim Laden der Datenschutzerklärung.</p>');
                } finally {
                    setLoadingLegal(false);
                }
            };
            fetchLegal();
        }
    }, [step]);

    const handleInitialSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!username || !email || !password) {
            setError('Bitte alle Felder ausfüllen.');
            return;
        }

        if (password.length < 6) {
            setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        // Proceed to legal step
        setStep('legal');
    };

    const handleFinalSubmit = async () => {
        if (!acceptedTerms) {
            setError('Bitte akzeptiere die Nutzungsbedingungen und Datenschutzrichtlinie.');
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            // Pass newsletter flag to signup
            await signup(username, password, email, subscribeNewsletter);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Konto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <PublicLayout mainClassName="pt-24 pb-12 flex flex-col items-center justify-center min-h-[80vh]">
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden transition-colors duration-300">
                {/* Background Glows */}
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-secondary/5 dark:bg-secondary/10 rounded-full blur-[150px]" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-lg relative z-10 mx-auto"
                >
                    <Card className="p-8 sm:p-10 border-border shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden relative">

                        <div className="mb-8 flex flex-col items-center">
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className={`mb-6 rounded-2xl p-4 text-white shadow-lg transform hover:scale-110 transition-transform duration-500 ${isSetup ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-secondary shadow-secondary/20'}`}
                            >
                                {isSetup ? <ShieldCheck size={32} /> : <UserPlus size={32} />}
                            </motion.div>
                            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2 text-center">
                                {isSetup ? 'System-Installation' : 'Konto erstellen'}
                            </h1>
                            <p className="text-muted-foreground text-center">
                                {step === 'register'
                                    ? (isSetup ? 'Erstelle das erste Administrator-Konto.' : 'Schritt 1: Deine Zugangsdaten')
                                    : 'Schritt 2: Rechtliches & Newsletter'
                                }
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {step === 'register' ? (
                                <motion.form
                                    key="register-form"
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -20, opacity: 0 }}
                                    onSubmit={handleInitialSubmit}
                                    className="space-y-5"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Benutzername</label>
                                        <Input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Dein eindeutiger Benutzername"
                                            required
                                            className="bg-background/50 border-border h-12"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">E-Mail-Adresse</label>
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="du@beispiel.de"
                                            required
                                            className="bg-background/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Passwort</label>
                                        <Input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            className="bg-background/50 border-border h-12"
                                        />
                                    </div>

                                    <Button type="submit" className="w-full mt-4 gap-2" size="lg">
                                        Weiter <ArrowRight size={18} />
                                    </Button>
                                </motion.form>
                            ) : (
                                <motion.div
                                    key="legal-step"
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 20, opacity: 0 }}
                                    className="space-y-6"
                                >
                                    {/* Scrollable Terms Area */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nutzungsbedingungen</label>
                                        <div className="h-48 rounded-xl border border-border bg-background/50 overflow-y-auto p-4 text-sm text-foreground/80 shadow-inner custom-scrollbar">
                                            {loadingLegal ? (
                                                <div className="flex items-center justify-center h-full text-muted-foreground">Lade Texte...</div>
                                            ) : (
                                                <article className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-li:text-foreground prose-a:text-primary">
                                                    <div dangerouslySetInnerHTML={{ __html: termsContent }} />
                                                </article>
                                            )}
                                        </div>
                                    </div>

                                    {/* Legal Checkboxes */}
                                    <div className="space-y-4">
                                        {/* Mandatory Terms */}
                                        <label className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/30 cursor-pointer hover:bg-background/50 transition-colors">
                                            <div className="relative flex items-center mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={acceptedTerms}
                                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <div className="w-5 h-5 rounded border border-muted-foreground/30 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center text-primary-foreground">
                                                    <Check size={14} className="opacity-0 peer-checked:opacity-100" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-muted-foreground leading-snug">
                                                Ich akzeptiere diese <span className="font-bold text-foreground">Nutzungsbedingungen</span> und habe die <Link to="/privacy" target="_blank" className="underline text-primary hover:text-primary/80">Datenschutzerklärung</Link> zur Kenntnis genommen. *
                                            </span>
                                        </label>

                                        {/* Optional Newsletter */}
                                        <label className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/30 cursor-pointer hover:bg-background/50 transition-colors">
                                            <div className="relative flex items-center mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={subscribeNewsletter}
                                                    onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <div className="w-5 h-5 rounded border border-muted-foreground/30 peer-checked:bg-secondary peer-checked:border-secondary transition-all flex items-center justify-center text-secondary-foreground">
                                                    <Check size={14} className="opacity-0 peer-checked:opacity-100" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-muted-foreground leading-snug">
                                                Ich möchte den kostenlosen <span className="font-bold text-foreground">Gabelguru-Newsletter</span> erhalten und über neue Funktionen und Angebote informiert werden. Eine Abmeldung ist jederzeit möglich.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep('register')}
                                            disabled={isLoading}
                                            className="px-3"
                                        >
                                            <ArrowLeft size={18} />
                                        </Button>
                                        <Button
                                            onClick={handleFinalSubmit}
                                            disabled={isLoading || !acceptedTerms}
                                            className="flex-1 gap-2"
                                            variant={acceptedTerms ? 'primary' : 'secondary'} // Highlight when ready
                                        >
                                            {isLoading ? 'Konto wird erstellt...' : 'Konto erstellen'}
                                            {!isLoading && <Check size={18} />}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        {!isSetup && step === 'register' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.0 }}
                                className="mt-8 text-center text-sm"
                            >
                                <span className="text-muted-foreground tracking-wide">Bereits Mitglied?</span>{' '}
                                <Link to="/login" className="font-bold text-secondary hover:text-secondary/80 transition-colors ml-1 underline decoration-secondary/30 underline-offset-4">
                                    Anmelden
                                </Link>
                            </motion.div>
                        )}
                    </Card>
                </motion.div>
            </div>
        </PublicLayout>
    );
}
