import { useEffect } from 'react';

export function useLockBodyScroll(isOpen) {
    useEffect(() => {
        if (isOpen) {
            // Get original overflow style
            const originalStyle = window.getComputedStyle(document.body).overflow;
            const originalOverscroll = window.getComputedStyle(document.body).overscrollBehaviorY;

            // Prevent scrolling on mount
            document.body.style.overflow = 'hidden';
            document.body.style.overscrollBehaviorY = 'none';

            // Re-enable scrolling when component unmounts
            return () => {
                document.body.style.overflow = originalStyle;
                document.body.style.overscrollBehaviorY = originalOverscroll;
            };
        }
    }, [isOpen]); // Only re-run if isOpen changes
}

export default useLockBodyScroll;
