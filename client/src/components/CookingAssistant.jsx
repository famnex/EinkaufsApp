import { useState, useEffect, useRef } from 'react';
import { Mic, Send, X, Volume2, VolumeX, Sparkles, Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function CookingAssistant({ isOpen, onClose, recipe }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `Hallo! Ich bin dein Koch-Assistent. Frag mich einfach, wenn du Hilfe bei "${recipe?.title}" brauchst.` }
    ]);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const audioContextRef = useRef(null);
    const audioRef = useRef(null); // Will hold the persistent HTMLAudioElement

    // Initialize Audio System once
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            // Pre-set some properties
            audioRef.current.preload = 'auto';
        }
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            }
        }
    }, []);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.lang = 'de-DE';
            recognitionRef.current.interimResults = false;

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                handleSend(transcript);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
                playAudioCue('end');
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };
        }
    }, [recipe]);

    // CRITICAL: Unlock Audio on iOS PWA
    const unlockAudio = () => {
        // Unlock Audio Element
        if (audioRef.current) {
            audioRef.current.play().then(() => {
                audioRef.current.pause();
                console.log("Audio element unlocked");
            }).catch(e => console.log("Audio unlock failed or not needed", e));
        }

        // Unlock AudioContext
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    // Audio Cues for UX
    const playAudioCue = (type) => {
        try {
            if (!audioContextRef.current) return;
            const ctx = audioContextRef.current;

            // Ensure context is running (unlock attempt)
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(type === 'start' ? 880 : 440, ctx.currentTime);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.warn("Audio Context error", e);
        }
    };

    const toggleListening = () => {
        unlockAudio(); // SYNCHRONOUS User Gesture
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsSpeaking(false);
            stopSpeaking();
            playAudioCue('start');
            setTimeout(() => {
                recognitionRef.current?.start();
                setIsListening(true);
            }, 100);
        }
    };

    const speak = async (text, isEnding = false) => {
        if (!text) return;

        // Stop any current playback
        stopSpeaking();

        try {
            setIsSpeaking(true);
            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.BASE_URL === '/' ? '/api' : `${import.meta.env.BASE_URL}api`.replace('//', '/'));
            const url = `${baseUrl}/ai/speak?text=${encodeURIComponent(text)}&token=${token}`;

            // Reuse the persistent audio object
            const audio = audioRef.current;
            audio.src = url;
            audio.load();

            audio.onended = () => {
                setIsSpeaking(false);
                if (!isEnding) {
                    setTimeout(() => {
                        toggleListening();
                    }, 400);
                }
            };

            audio.onerror = () => {
                setIsSpeaking(false);
                console.error("Audio playback error");
            };

            // This play call should now work because the object was "unlocked" during handleSend or toggleListening
            await audio.play();
        } catch (err) {
            console.error("TTS generation failed", err);
            setIsSpeaking(false);
        }
    };

    const stopSpeaking = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = ""; // Clear source
        }
        setIsSpeaking(false);
    };

    const handleSend = async (text = inputText) => {
        if (!text.trim()) return;
        unlockAudio(); // SYNCHRONOUS User Gesture

        // Detect termination
        const terminationWords = ['ok', 'danke', 'alles klar', 'fertig', 'stopp', 'tschüss', 'ciao'];
        const isEnding = terminationWords.some(word => text.toLowerCase().includes(word));

        // Add User Message
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        try {
            // Prepare Context
            const context = {
                title: recipe.title,
                ingredients: recipe.RecipeIngredients?.map(ri => ({
                    name: ri.Product?.name,
                    amount: ri.quantity,
                    unit: ri.unit
                })),
                steps: recipe.instructions,
                isEnding // Tell AI to keep it brief if ending
            };

            const { data } = await api.post('/ai/chat', {
                message: text,
                context
            });

            const replyMsg = { role: 'assistant', content: data.reply };
            setMessages(prev => [...prev, replyMsg]);

            // Pass the ending flag to speak so it knows whether to restart mic
            speak(data.reply, isEnding);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldigung, ich habe gerade Verbindungsprobleme.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed right-4 md:bottom-8 md:right-8 z-[60] w-[90vw] md:w-96 h-[500px] max-h-[80vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
                style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
                {/* Header */}
                <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot size={24} />
                        <h3 className="font-bold">Chef Assistant</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                                    : "bg-card border border-border mr-auto rounded-tl-none shadow-sm"
                            )}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="bg-card border border-border mr-auto rounded-2xl rounded-tl-none p-3 shadow-sm w-16 flex items-center justify-center">
                            <span className="flex gap-1">
                                <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></span>
                            </span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-border bg-card">
                    {/* Voice Feedback */}
                    {isListening && (
                        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse z-10 backdrop-blur-sm">
                            <Mic size={14} />
                            Ich höre zu...
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={toggleListening}
                            className={cn(
                                "p-3 rounded-full transition-all shadow-md flex items-center justify-center",
                                isListening
                                    ? "bg-red-500 text-white animate-pulse ring-4 ring-red-500/30"
                                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            )}
                            title="Sprechen"
                        >
                            <Mic size={20} />
                        </button>

                        <div className="flex-1 relative">
                            <input
                                className="w-full bg-muted border-none rounded-full pl-4 pr-10 py-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                placeholder="Frage etwas..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!inputText.trim() || isLoading}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full transition-colors disabled:opacity-50"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Speaking Indicator/Stop */}
                <AnimatePresence>
                    {isSpeaking && (
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            onClick={stopSpeaking}
                            className="absolute top-16 right-4 bg-white/90 text-black shadow-lg border border-black/10 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md z-10"
                        >
                            <Volume2 size={12} className="text-primary animate-pulse" />
                            Stop
                        </motion.button>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}
