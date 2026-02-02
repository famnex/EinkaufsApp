import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export default function Skeleton({ className, ...props }) {
    return (
        <motion.div
            animate={{
                opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
            }}
            className={cn("rounded-md bg-muted", className)}
            {...props}
        />
    );
}

export function SessionSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between overflow-hidden relative shadow-lg mb-4">
            <div className="flex items-center gap-5 relative z-10 w-full">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
        </div>
    );
}
