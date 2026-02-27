import { AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function IntoleranceIcon({ probability, className }) {
    if (probability === undefined || probability === null || probability < 30) return null;

    if (probability >= 80) {
        return (
            <AlertCircle
                size={14}
                className={cn("text-destructive animate-pulse-subtle shrink-0", className)}
                title={`${probability}% Wahrscheinlichkeit für Unverträglichkeit`}
            />
        );
    }

    return (
        <HelpCircle
            size={14}
            className={cn("text-orange-500 shrink-0", className)}
            title={`${probability}% Wahrscheinlichkeit für Unverträglichkeit`}
        />
    );
}
