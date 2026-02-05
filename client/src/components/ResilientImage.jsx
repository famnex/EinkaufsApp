import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export default function ResilientImage({ src, alt, className, containerClassName }) {
    const [status, setStatus] = useState('loading'); // loading, loaded, error
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!src) {
            setStatus('error');
            return;
        }

        setStatus('loading');
        const img = new Image();
        img.src = src;

        img.onload = () => {
            setStatus('loaded');
        };

        img.onerror = () => {
            console.warn(`Failed to load image: ${src}, retry: ${retryCount}`);

            // Auto-retry up to 3 times with exponential backoff
            if (retryCount < 3) {
                const timeout = Math.pow(2, retryCount) * 1000;
                setTimeout(() => {
                    setRetryCount(c => c + 1);
                    // Trigger re-render/re-check by effectively just waiting for this timeout
                    // Since we depend on retryCount in the effect if we were to depend on it, 
                    // but here we just want to restart the process.
                    // Actually, modifying src cache buster might be needed if it's a persistent network error,
                    // but for "bad reception" often just waiting works.
                    // For now, let's keep it simple: manual retry UI appears after error, 
                    // but let's try auto-retry logic simply by resetting status to loading if we want auto-retry loops.

                    // Actually, the useEffect runs on 'src'. If we want to retry the SAME src, we need a trigger.
                    // Let's use a key or a trigger state.
                }, timeout);
            } else {
                setStatus('error');
            }
        };

        // Cleanup
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src, retryCount]);

    const handleManualRetry = useCallback((e) => {
        e.stopPropagation();
        setRetryCount(0); // This will trigger the effect again
        setStatus('loading');
    }, []);

    return (
        <div className={cn("relative overflow-hidden bg-muted flex items-center justify-center group", containerClassName)}>
            {status === 'loaded' && (
                <img
                    src={src}
                    alt={alt}
                    className={cn("w-full h-full object-cover transition-opacity duration-500", className)}
                />
            )}

            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 backdrop-blur-sm z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    {retryCount > 0 && <span className="text-xs text-muted-foreground">Versuch {retryCount + 1}...</span>}
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4 text-center">
                    <ImageOff className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                    <span className="text-xs text-muted-foreground mb-2">Bild konnte nicht geladen werden</span>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleManualRetry}
                        className="gap-2 h-8 text-xs"
                    >
                        <RefreshCw size={12} />
                        Neu laden
                    </Button>
                </div>
            )}
        </div>
    );
}
