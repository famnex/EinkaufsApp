import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import PublicLayout from '../components/PublicLayout';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const token = searchParams.get('token');
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Ungültiger oder fehlender Bestätigungs-Token.');
                return;
            }

            try {
                const { data } = await api.post('/auth/verify-email', { token });
                setStatus('success');
                setMessage(data.message || 'Konto erfolgreich aktiviert!');
                // Clear old session because verification increments tokenVersion on server
                logout();
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.error || 'Verifizierung fehlgeschlagen. Der Link ist möglicherweise abgelaufen.');
            }
        };

        verify();
    }, [token]);

    return (
        <PublicLayout mainClassName="pt-24 pb-12 flex flex-col items-center justify-center min-h-[80vh]">
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden transition-colors duration-300">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[150px]" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md relative z-10 mx-auto"
                >
                    <Card className="p-8 sm:p-10 border-border shadow-2xl bg-card/50 backdrop-blur-xl text-center">
                        <div className="mb-8 flex flex-col items-center">
                            {status === 'loading' && (
                                <>
                                    <div className="mb-6 rounded-2xl bg-primary/10 p-4 text-primary animate-pulse">
                                        <Loader2 size={32} className="animate-spin" />
                                    </div>
                                    <h1 className="text-2xl font-bold mb-2">Verifizierung läuft...</h1>
                                    <p className="text-muted-foreground">Wir prüfen deinen Bestätigungslink.</p>
                                </>
                            )}

                            {status === 'success' && (
                                <>
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="mb-6 rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-500/20"
                                    >
                                        <CheckCircle2 size={32} />
                                    </motion.div>
                                    <h1 className="text-2xl font-bold mb-2">Super! 🎉</h1>
                                    <p className="text-muted-foreground mb-8">{message}</p>
                                    <Button onClick={() => navigate('/login')} className="w-full gap-2" size="lg">
                                        Jetzt anmelden <ArrowRight size={18} />
                                    </Button>
                                </>
                            )}

                            {status === 'error' && (
                                <>
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="mb-6 rounded-2xl bg-destructive p-4 text-white shadow-lg shadow-destructive/20"
                                    >
                                        <XCircle size={32} />
                                    </motion.div>
                                    <h1 className="text-2xl font-bold mb-2">Halt da! 🛑</h1>
                                    <p className="text-muted-foreground mb-8">{message}</p>
                                    <div className="flex flex-col gap-3 w-full">
                                        <Button onClick={() => navigate('/login')} variant="secondary" className="w-full">
                                            Zurück zum Login
                                        </Button>
                                        <Button onClick={() => navigate('/forgot-password')} variant="ghost" className="w-full text-xs">
                                            Neuen Link anfordern?
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                </motion.div>
            </div>
        </PublicLayout>
    );
}
