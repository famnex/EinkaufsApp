import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../lib/axios';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import PublicLayout from '../components/PublicLayout';
import { motion } from 'framer-motion';
import { KeyRound, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein.');
            return;
        }

        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        setIsLoading(true);

        try {
            const { data } = await axios.post('/auth/reset-password', { token, newPassword: password });
            setMessage(data.message);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Zurücksetzen des Passworts.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <PublicLayout mainClassName="pt-24 pb-12 flex flex-col items-center justify-center min-h-[80vh]">
                <Card className="p-8 border-border shadow-xl bg-card/50 backdrop-blur-xl max-w-md w-full text-center">
                    <p className="text-destructive mb-4">Ungültiger Link. Es fehlt der Reset-Token.</p>
                    <Link to="/login"><Button>Zum Login</Button></Link>
                </Card>
            </PublicLayout>
        );
    }

    return (
        <PublicLayout mainClassName="pt-24 pb-12 flex flex-col items-center justify-center min-h-[80vh]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10 mx-auto"
            >
                <Card className="p-8 border-border shadow-2xl bg-card/50 backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary"
                        >
                            <KeyRound size={24} />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Neues Passwort</h1>
                        <p className="text-muted-foreground text-sm">
                            Erstelle ein neues Passwort für deinen Account.
                        </p>
                    </div>

                    {!message ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Neues Passwort</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-background/50 border-border h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Passwort bestätigen</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-background/50 border-border h-12"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                {isLoading ? 'Speichern...' : 'Passwort speichern'}
                            </Button>
                        </form>
                    ) : (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
                                <CheckCircle size={32} />
                            </div>
                            <div className="text-green-600 dark:text-green-400 font-medium">
                                {message}
                            </div>
                            <p className="text-sm text-muted-foreground">Du wirst in Kürze zum Login weitergeleitet...</p>
                        </div>
                    )}
                </Card>
            </motion.div>
        </PublicLayout>
    );
}
