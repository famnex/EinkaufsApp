import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Megaphone, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStartup } from '../contexts/StartupContext';
import api from '../lib/axios';

const NewsPopup = () => {
    const { user } = useAuth();
    const { canShowNews, setIsNewsPopupActive } = useStartup();
    const [messages, setMessages] = useState([]);
    const [isVisible, setIsVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // Nur prüfen, wenn der User existiert und an der Reihe ist
        if (!user || !canShowNews) return;

        const fetchUnreadMessages = async () => {
            try {
                const response = await api.get('/app-messages/unread');
                if (response.data && response.data.length > 0) {
                    setMessages(response.data);
                    setIsVisible(true);
                    setIsNewsPopupActive(true);
                }
            } catch (err) {
                console.error('Fehler beim Laden der App-Nachrichten', err);
            }
        };

        fetchUnreadMessages();
    }, [user, canShowNews, setIsNewsPopupActive]);

    // Sperre den Body-Scroll, wenn das Modal offen ist
    useEffect(() => {
        if (isVisible) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isVisible]);

    const handleDismiss = async () => {
        if (!messages[currentIndex]) return;

        const messageId = messages[currentIndex].id;

        try {
            // Im Backend als gelesen markieren
            await api.post(`/app-messages/${messageId}/read`);
        } catch (err) {
            console.error('Fehler beim Markieren als gelesen', err);
        }

        // Zum nächsten übergehen oder schließen
        if (currentIndex < messages.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsVisible(false);
            setIsNewsPopupActive(false);
            setTimeout(() => setMessages([]), 500); // Aufräumen nach Animation
        }
    };

    if (!isVisible || messages.length === 0) return null;

    const currentMessage = messages[currentIndex];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm sm:p-6"
                    style={{ overscrollBehaviorY: 'contain' }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative w-full max-w-lg bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
                    >
                        {/* Status Bar / Indicator for multiple messages */}
                        {messages.length > 1 && (
                            <div className="absolute top-0 left-0 right-0 h-1 flex bg-muted">
                                {messages.map((_, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`flex-1 ${idx <= currentIndex ? 'bg-primary' : 'bg-transparent'} transition-colors duration-300`}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="absolute top-3 right-3 z-10">
                            <button
                                onClick={handleDismiss}
                                className="p-2 bg-muted/50 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                aria-label="Schließen"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Top Banner / Icon Banner */}
                        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6 flex flex-col items-center justify-center border-b border-border/50">
                            <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-3 shadow-inner">
                                <Megaphone size={32} />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-center pr-8 pl-8">
                                {currentMessage.title}
                            </h2>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {currentMessage.text}
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-muted/20">
                            <button
                                onClick={handleDismiss}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                            >
                                <CheckCircle2 size={20} />
                                {messages.length > 1 && currentIndex < messages.length - 1 
                                    ? 'Gelesen & Weiter' 
                                    : 'Alles klar, verstanden!'}
                            </button>
                            {messages.length > 1 && (
                                <p className="text-center text-xs text-muted-foreground mt-3 font-medium">
                                    Nachricht {currentIndex + 1} von {messages.length}
                                </p>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NewsPopup;
