import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LoadingOverlay({ isLoading, children, className }) {
    const [showSpinner, setShowSpinner] = useState(false);

    useEffect(() => {
        let timeout;
        if (isLoading) {
            timeout = setTimeout(() => {
                setShowSpinner(true);
            }, 100);
        } else {
            setShowSpinner(false);
        }
        return () => clearTimeout(timeout);
    }, [isLoading]);

    return (
        <div className={cn("relative min-h-[100px]", className)}>
            {showSpinner && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-xl transition-all duration-300 animate-in fade-in">
                    <Loader2 className="animate-spin text-primary drop-shadow-md" size={40} strokeWidth={2.5} />
                </div>
            )}
            {children}
        </div>
    );
}
