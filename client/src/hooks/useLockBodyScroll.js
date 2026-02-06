import { useEffect } from 'react';

export function useLockBodyScroll(isOpen) {
    useEffect(() => {
        if (isOpen) {
            // Get original overflow style
            const originalStyle = window.getComputedStyle(document.body).overflow;
            // Prevent scrolling on mount
            document.body.style.overflow = 'hidden';

            // Re-enable scrolling when component unmounts
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [isOpen]); // Only re-run if isOpen changes
}

export default useLockBodyScroll;
