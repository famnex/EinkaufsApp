import { cn } from "../lib/utils";

export function Input({ className, ...props }) {
    return (
        <input
            className={cn(
                "flex h-12 w-full rounded-xl border border-input bg-muted/50 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-background disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
}
