import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { UserPlus, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';

export default function SignupPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const isSetup = searchParams.get('setup') === 'true';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await signup(username, password, email);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Could not create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background relative overflow-hidden font-['Outfit'] transition-colors duration-300">
            {/* Background Glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[150px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-secondary/5 dark:bg-secondary/10 rounded-full blur-[150px]" />

            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                <Card className="p-8 sm:p-10 border-border shadow-2xl bg-card/50 backdrop-blur-xl">
                    <div className="mb-10 flex flex-col items-center">
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className={`mb-6 rounded-2xl p-4 text-white shadow-lg transform hover:scale-110 transition-transform duration-500 ${isSetup ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-secondary shadow-secondary/20'}`}
                        >
                            {isSetup ? <ShieldCheck size={32} /> : <UserPlus size={32} />}
                        </motion.div>
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-bold text-foreground tracking-tight mb-2 text-center"
                        >
                            {isSetup ? 'System-Installation' : 'Werde Teil von LISTENX'}
                        </motion.h1>
                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-muted-foreground text-center"
                        >
                            {isSetup
                                ? 'Erstelle das erste Administrator-Konto.'
                                : <>Verwalte deine Listen mit <span className="text-foreground font-semibold">Stil</span></>
                            }
                        </motion.p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="space-y-2"
                        >
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Benutzername</label>
                            <Input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Dein eindeutiger Benutzername"
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
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">E-Mail-Adresse</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="du@beispiel.de"
                                className="bg-background/50 border-border h-12"
                            />
                        </motion.div>
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
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
                        </motion.div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                            >
                                {error}
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <Button type="submit" variant="secondary" className="w-full mt-4" size="lg" disabled={isLoading}>
                                {isLoading ? 'Konto wird erstellt...' : 'Konto erstellen'}
                            </Button>
                        </motion.div>
                    </form>

                    {!isSetup && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.0 }}
                            className="mt-10 text-center text-sm"
                        >
                            <span className="text-muted-foreground tracking-wide">Bereits Mitglied?</span>{' '}
                            <Link to="/login" className="font-bold text-secondary hover:text-secondary/80 transition-colors ml-1 underline decoration-secondary/30 underline-offset-4">
                                Anmelden
                            </Link>
                        </motion.div>
                    )}
                </Card>
            </motion.div>
        </div >
    );
}
