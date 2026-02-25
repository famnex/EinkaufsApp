import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../lib/axios';
import { MailX, CheckCircle, ArrowLeft } from 'lucide-react';
import { Card } from '../components/Card';

export default function UnsubscribeNewsletter() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMsg('Der Abmeldelink ist ungültig oder unvollständig.');
        }
    }, [token]);

    const handleUnsubscribe = async () => {
        setStatus('loading');
        try {
            await axios.post('/newsletter/unsubscribe', { token });
            setStatus('success');
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.response?.data?.error || 'Fehler beim Abmelden vom Newsletter.');
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-border shadow-2xl relative overflow-hidden">
                {/* Decorative background blur */}
                <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-primary/20 blur-3xl rounded-full" />
                <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-secondary/20 blur-3xl rounded-full" />

                <div className="p-8 relative z-10 flex flex-col items-center text-center">

                    {status === 'idle' && (
                        <>
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                                <MailX className="w-8 h-8 text-destructive" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-3">Newsletter abbestellen</h2>
                            <p className="text-muted-foreground mb-8">
                                Möchtest du dich wirklich vom Gabelguru-Newsletter abmelden? Du erhältst dann keine Updates und Neuigkeiten mehr von uns.
                            </p>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={handleUnsubscribe}
                                    className="w-full bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold py-3 px-4 rounded-xl transition-colors duration-200"
                                >
                                    Ja, vom Newsletter abmelden
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full bg-secondary/10 hover:bg-secondary/20 text-secondary-foreground font-semibold py-3 px-4 rounded-xl transition-colors duration-200"
                                >
                                    Nein, doch angemeldet bleiben
                                </button>
                            </div>
                        </>
                    )}

                    {status === 'loading' && (
                        <div className="py-12 flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                            <p className="text-muted-foreground">Abmeldung wird verarbeitet...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-3">Erfolgreich abgemeldet</h2>
                            <p className="text-muted-foreground mb-8">
                                Schade, dass du gehst! Deine E-Mail-Adresse wurde erfolgreich aus unserem Newsletter-Verteiler entfernt.
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                            >
                                Zurück zur Startseite
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                                <MailX className="w-8 h-8 text-destructive" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-3">Fehler bei der Abmeldung</h2>
                            <p className="text-muted-foreground mb-8">
                                {errorMsg}
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-secondary/20 hover:bg-secondary/30 text-foreground font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200"
                            >
                                <ArrowLeft className="w-4 h-4" /> Zurück zur Startseite
                            </button>
                        </>
                    )}

                </div>
            </Card>
        </div>
    );
}
