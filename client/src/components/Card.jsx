import { cn } from "../lib/utils";

export function Card({ className, children, variant = "default", ...props }) {
    return (
        <div
            className={cn(
                "rounded-2xl border transition-all duration-300",
                variant === "glass" && "glass backdrop-blur-xl",
                variant === "dark" && "glass-dark backdrop-blur-2xl",
                variant === "default" && "bg-card/50 border-border backdrop-blur-md",
                "hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
