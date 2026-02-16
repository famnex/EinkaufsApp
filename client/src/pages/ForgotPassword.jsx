import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../lib/axios';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import PublicLayout from '../components/PublicLayout';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [devLink, setDevLink] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setDevLink(null);
        setIsLoading(true);

        try {
            const { data } = await axios.post('/auth/forgot-password', { email });
            setMessage(data.message);
            if (data.devLink) {
                setDevLink(data.devLink);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Fehler beim Senden der Anfrage.');
        } finally {
            setIsLoading(false);
        }
    };

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
                            <Mail size={24} />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Passwort vergessen?</h1>
                        <p className="text-muted-foreground text-sm">
                            Gib deine Email-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.
                        </p>
                    </div>

                    {!message ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="deine@email.de"
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
                                {isLoading ? 'Sende Link...' : 'Link anfordern'}
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm text-center">
                                {message}
                            </div>

                            {devLink && (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs break-all">
                                    <p className="font-bold text-amber-600 dark:text-amber-400 mb-2">DEV MODE LINK:</p>
                                    <a href={devLink} className="text-primary hover:underline">{devLink}</a>
                                </div>
                            )}

                            <Link to="/login">
                                <Button variant="outline" className="w-full">Zurück zum Login</Button>
                            </Link>
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft size={14} className="mr-1" /> Zurück zum Login
                        </Link>
                    </div>
                </Card>
            </motion.div>
        </PublicLayout>
    );
}
