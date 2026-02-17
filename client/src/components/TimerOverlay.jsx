import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Trash2, X, Timer as TimerIcon, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TimerOverlay({ timers, onUpdate, onDelete }) {
    if (!timers || timers.length === 0) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[210] flex flex-col items-end max-w-[95vw] pointer-events-none">
            <div className="flex flex-row-reverse flex-wrap justify-end gap-2 w-full">
                <AnimatePresence>
                    {timers.map((timer) => (
                        <div key={timer.id} className="transition-all duration-300 w-fit max-w-full">
                            <TimerItem
                                timer={timer}
                                onUpdate={(updates) => onUpdate(timer.id, updates)}
                                onDelete={() => onDelete(timer.id)}
                            />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function TimerItem({ timer, onUpdate, onDelete }) {
    const [timeLeft, setTimeLeft] = useState(timer.remaining);
    const [isExpanded, setIsExpanded] = useState(window.innerWidth > 768);
    const intervalRef = useRef(null);
    const alarmCtxRef = useRef(null);
    const alarmIntervalRef = useRef(null);

    // Format time (HH:MM:SS or MM:SS)
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // Countdown Logic
    useEffect(() => {
        let interval = null;
        if (timer.isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timer.isRunning, timeLeft > 0]);

    // Alarm Logic
    useEffect(() => {
        if (timeLeft === 0 && timer.isRunning) {
            startAlarm();
            setIsExpanded(true); // Auto-expand when finished
        } else {
            stopAlarm();
        }

        return () => {
            // This runs on unmount (delete) or if dependencies change (pause)
            stopAlarm();
        };
    }, [timeLeft === 0, timer.isRunning]);

    // Update parent state periodically
    useEffect(() => {
        onUpdate({ remaining: timeLeft });
    }, [timeLeft]);

    const startAlarm = () => {
        if (alarmIntervalRef.current) return;
        console.log("ALARM: Starting for timer", timer.label);

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            alarmCtxRef.current = ctx;

            const playDing = (freq, timeOffset) => {
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + timeOffset);

                gain.gain.setValueAtTime(0, now + timeOffset);
                gain.gain.linearRampToValueAtTime(0.3, now + timeOffset + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + 0.8);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + timeOffset);
                osc.stop(now + timeOffset + 1);
            };

            const playMelody = () => {
                if (ctx.state === 'suspended') ctx.resume();
                console.log("ALARM: Playing melody iteration...");
                playDing(880, 0);       // A5
                playDing(1174.66, 0.2); // D6
                playDing(1318.51, 0.4); // E6
            };

            playMelody();
            alarmIntervalRef.current = setInterval(playMelody, 2500);
        } catch (e) {
            console.error("ALARM: Error starting audio context:", e);
        }
    };

    const stopAlarm = () => {
        if (alarmIntervalRef.current) {
            console.log("ALARM: Stopping interval for timer", timer.label);
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }
        if (alarmCtxRef.current) {
            console.log("ALARM: Closing AudioContext for timer", timer.label);
            try {
                alarmCtxRef.current.close();
            } catch (e) {
                console.error("ALARM: Error closing context:", e);
            }
            alarmCtxRef.current = null;
        }
    };

    const progress = (timeLeft / timer.duration) * 100;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            onClick={() => !isExpanded && setIsExpanded(true)}
            className={cn(
                "bg-card border border-border rounded-2xl shadow-xl flex flex-col pointer-events-auto cursor-pointer overflow-hidden transition-all duration-300",
                isExpanded ? "p-3 md:p-4 gap-1 md:gap-2 min-w-[200px] md:min-w-[280px] w-full" : "p-2 h-12 justify-center gap-0.5 min-w-[120px] w-auto",
                timeLeft === 0 && "ring-2 ring-red-500 animate-pulse bg-red-50 dark:bg-red-950/20"
            )}
        >
            {/* Header / Compact Title */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground min-w-0">
                    <TimerIcon size={isExpanded ? 16 : 14} className={cn("shrink-0", timeLeft === 0 && "text-red-500")} />
                    <span className={cn(
                        "font-bold uppercase tracking-wider truncate",
                        isExpanded ? "text-[10px] md:text-xs" : "text-[10px]"
                    )}>
                        {timer.label}
                    </span>
                    {!isExpanded && (
                        <span className={cn(
                            "text-[10px] font-mono ml-1 shrink-0",
                            timeLeft === 0 ? "text-red-500 font-black animate-pulse" : "text-foreground"
                        )}>
                            {formatTime(timeLeft)}
                        </span>
                    )}
                </div>
                {isExpanded && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                        className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground shrink-0 ml-auto"
                        title="Minimieren"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-2 md:gap-3"
                    >
                        <div className="flex items-center justify-between gap-1.5 shrink-0">
                            <div className={cn(
                                "text-2xl md:text-3xl font-black font-mono tracking-tighter shrink-0",
                                timeLeft === 0 ? "text-red-500" : "text-foreground"
                            )}>
                                {formatTime(timeLeft)}
                            </div>

                            <div className="flex gap-1.5 shrink-0">
                                {timeLeft > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpdate({ isRunning: !timer.isRunning }); }}
                                        className={cn(
                                            "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all",
                                            timer.isRunning
                                                ? "bg-secondary text-secondary-foreground"
                                                : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        )}
                                    >
                                        {timer.isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 transition-all"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress Bar */}
            <div className={cn(
                "w-full bg-muted rounded-full overflow-hidden shrink-0",
                isExpanded ? "h-1.5 md:h-2 mt-1" : "h-[3px] mt-0.5"
            )}>
                <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: `${progress}%` }}
                    className={cn(
                        "h-full transition-colors",
                        timeLeft === 0 ? "bg-red-500" : "bg-primary"
                    )}
                />
            </div>

            {isExpanded && timeLeft === 0 && (
                <div className="text-[8px] md:text-[10px] text-red-500 font-bold text-center uppercase tracking-widest mt-0.5 animate-bounce">
                    Zeit abgelaufen!
                </div>
            )}
        </motion.div>
    );
}
