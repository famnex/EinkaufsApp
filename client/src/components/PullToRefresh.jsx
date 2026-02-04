import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
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
            // Only capture if at the top of the page
            if (window.scrollY === 0) {
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
                }, 500);
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
                    "absolute left-0 right-0 -top-12 flex justify-center items-center h-12 transition-opacity pointer-events-none",
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

            {/* Refreshing Overlay (Optional, for better UX) */}
            {isRefreshing && (
                <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] z-[9999] pointer-events-none" />
            )}
        </div>
    );
};
