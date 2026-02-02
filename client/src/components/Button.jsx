import { cn } from "../lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }) {
    const variants = {
        primary: "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-secondary text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:scale-[1.02] active:scale-[0.98]",
        outline: "border border-border bg-card text-foreground hover:bg-muted hover:border-primary/50 active:scale-[0.98]",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.98]",
        danger: "bg-destructive text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-destructive/90 active:scale-[0.98]",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2.5 font-semibold",
        lg: "px-8 py-4 text-lg font-bold uppercase tracking-wider",
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        />
    );
}
