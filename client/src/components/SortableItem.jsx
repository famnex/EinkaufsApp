import React from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: props.id,
        disabled: props.disabled,
        animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: false })
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 400ms ease',
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.3 : 1
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={props.className}>
            {props.children}
        </div>
    );
}
