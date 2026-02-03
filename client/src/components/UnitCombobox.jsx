import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export function UnitCombobox({ value, onChange, suggestions = [], disabled = false, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (unit) => {
        onChange(unit);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <div className="relative flex w-full">
                <input
                    type="text"
                    className={cn(
                        "flex-1 h-8 text-xs bg-background border border-border rounded-l-lg pl-1 pr-1 focus:ring-1 focus:ring-primary focus:outline-none min-w-0",
                        disabled && "opacity-70 bg-muted cursor-not-allowed"
                    )}
                    value={value}
                    disabled={disabled}
                    placeholder="Einheit"
                    onChange={(e) => onChange(e.target.value)}
                />
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={cn(
                        "h-8 px-2 bg-background border border-l-0 border-border rounded-r-lg hover:bg-muted transition-colors flex-shrink-0",
                        disabled && "opacity-70 cursor-not-allowed"
                    )}
                >
                    <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && !disabled && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto overflow-x-hidden">
                    {suggestions.map((unit, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelect(unit)}
                            className={cn(
                                "w-full text-left px-2 py-1.5 text-xs hover:bg-primary/10 transition-colors truncate",
                                value === unit && "bg-primary/5 font-bold text-primary"
                            )}
                        >
                            {unit}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
