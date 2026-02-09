import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ShoppingBag, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export const PullToRefresh = ({ children }) => {
    const [pullStart, setPullStart] = useState(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef(null);

    const PULL_THRESHOLD = 150; // Distance in px to trigger refresh
    const MAX_PULL = 200; // Max pull distance

    useEffect(() => {
        const handleTouchStart = (e) => {
            // Only capture if at the top of the page AND no modal is open (body scroll not locked)
            if (window.scrollY === 0 && document.body.style.overflow !== 'hidden') {
                setPullStart(e.touches[0].pageY);
            }
        };

        const handleTouchMove = (e) => {
            if (pullStart === null || isRefreshing) return;

            const pullCurrent = e.touches[0].pageY;
            const distance = Math.max(0, pullCurrent - pullStart);

            // Apply resistance
            const resistanceDistance = distance / 2.5;

            if (resistanceDistance > 0) {
                setPullDistance(Math.min(resistanceDistance, MAX_PULL));
                // Prevent scrolling when pulling down
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        };

        const handleTouchEnd = () => {
            if (pullDistance >= PULL_THRESHOLD) {
                setIsRefreshing(true);
                // Trigger refresh
                setTimeout(() => {
                    window.location.reload();
                }, 1000); // Give users a moment to see the animation
            }
            setPullStart(null);
            setPullDistance(0);
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [pullStart, pullDistance, isRefreshing]);

    return (
        <div ref={containerRef} className="relative transition-transform duration-100 ease-out" style={{
            transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none'
        }}>
            {/* Pull Indicator */}
            <div
                className={cn(
                    "absolute left-0 right-0 -top-12 flex justify-center items-center h-12 transition-opacity pointer-events-none z-[60]",
                    pullDistance > 10 ? "opacity-100" : "opacity-0"
                )}
                style={{ transform: `translateY(-${Math.min(40, pullDistance * 0.2)}px)` }}
            >
                <div className={cn(
                    "bg-primary text-primary-foreground p-2 rounded-full shadow-lg flex items-center justify-center transition-transform",
                    isRefreshing ? "animate-spin" : ""
                )}
                    style={{
                        transform: !isRefreshing ? `rotate(${pullDistance * 2}deg) scale(${Math.min(1, pullDistance / 100)})` : 'none'
                    }}
                >
                    <RefreshCw size={20} />
                </div>
            </div>

            {children}

            {/* Premium Refreshing Overlay */}
            <AnimatePresence>
                {isRefreshing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-background/60 backdrop-blur-md z-[10000] flex flex-col items-center justify-center gap-6 pointer-events-auto"
                    >
                        <div className="relative">
                            {/* Animated Shopping Bag */}
                            <motion.div
                                animate={{
                                    y: [0, -20, 0],
                                    rotate: [0, -5, 5, 0]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                            >
                                <ShoppingBag size={64} strokeWidth={1.5} />
                            </motion.div>

                            {/* Particles/Sparkles */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-primary/20 blur-2xl rounded-full -z-10"
                            />
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl font-bebas tracking-widest text-primary"
                            >
                                Aktualisierung läuft
                            </motion.div>

                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                        className="w-1.5 h-1.5 bg-primary rounded-full"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Fun fact or quote could go here */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            transition={{ delay: 1 }}
                            className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground absolute bottom-12"
                        >
                            GabelGuru wird aufpoliert
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
