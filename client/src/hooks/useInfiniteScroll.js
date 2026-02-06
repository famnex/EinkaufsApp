import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook for client-side infinite scrolling.
 * slicing a large array into visible chunks as the user scrolls.
 * 
 * @param {Array} items - The full array of items to display
 * @param {number} pageSize - Number of items to load per "page"
 * @returns {Object} { visibleItems, observerTargetRef }
 */
export function useInfiniteScroll(items, pageSize = 24) {
    // Current number of *pages* visible
    const [page, setPage] = useState(1);
    const observerTarget = useRef(null);

    // Reset pagination when the underlying dataset changes (e.g. searching/filtering)
    useEffect(() => {
        setPage(1);
    }, [items]);

    // Calculate the subset of items to render
    const visibleItems = useMemo(() => {
        return items.slice(0, page * pageSize);
    }, [items, page, pageSize]);

    // Setup the Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    // Only load more if we haven't shown everything yet
                    if (visibleItems.length < items.length) {
                        setPage(prev => prev + 1);
                    }
                }
            },
            {
                threshold: 0.1,
                // Start loading slightly before the user hits the bottom
                rootMargin: '200px'
            }
        );

        const currentTarget = observerTarget.current;

        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [visibleItems.length, items.length]);

    return { visibleItems, observerTarget };
}

export default useInfiniteScroll;
