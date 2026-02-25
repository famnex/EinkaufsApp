import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../lib/axios';

const RichTextEditor = memo(({ value, onChange, placeholder, className, minHeight = '150px' }) => {
    const quillRef = useRef(null);
    const [localValue, setLocalValue] = useState(value || '');
    const lastPushedValue = useRef(value || '');
    const timeoutRef = useRef(null);

    // Synchronize local state with external value changes
    useEffect(() => {
        // Only update local value if the external value is different from what we last pushed
        // AND it's different from our current local state.
        if (value !== lastPushedValue.current && value !== localValue) {
            setLocalValue(value || '');
            lastPushedValue.current = value || '';
        }
    }, [value]);

    const handleChange = (content, delta, source, editor) => {
        setLocalValue(content);

        // Only propagate changes to father if it was a user action
        // This helps prevent cursor jumps from circular updates
        if (source === 'user') {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                const currentVal = editor.getHTML();
                lastPushedValue.current = currentVal;
                onChange(currentVal);
            }, 500);
        }
    };

    // Custom image handler for uploading to server
    const imageHandler = () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('image', file);

            try {
                // We assume there's an endpoint for this
                const response = await api.post('/newsletter/upload-image', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                const url = response.data.url;
                const quill = quillRef.current.getEditor();
                const range = quill.getSelection();
                quill.insertEmbed(range.index, 'image', url);
                quill.setSelection(range.index + 1);
            } catch (error) {
                console.error('Image upload failed:', error);
                alert('Bild-Upload fehlgeschlagen. Bitte versuche es erneut.');
            }
        };
    };

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image'],
                ['clean']
            ],
            handlers: {
                image: imageHandler
            }
        },
        clipboard: {
            matchVisual: false,
        }
    }), []);

    const formats = useMemo(() => [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'link', 'image',
        'color', 'background'
    ], []);

    return (
        <div className={className}>
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                modules={modules}
                formats={formats}
                className="rich-text-editor-container"
            />
            <style>{`
                .rich-text-editor-container .ql-editor {
                    min-height: ${minHeight};
                    font-size: inherit;
                    color: inherit;
                }
                .rich-text-editor-container .ql-container {
                    border-bottom-left-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                    background-color: transparent;
                }
                .rich-text-editor-container .ql-toolbar {
                    border-top-left-radius: 0.5rem;
                    border-top-right-radius: 0.5rem;
                    background-color: rgba(var(--muted), 0.5);
                    border-color: rgba(var(--border), 0.5);
                }
                .rich-text-editor-container .ql-container.ql-snow {
                    border-color: rgba(var(--border), 0.5);
                }
                .rich-text-editor-container .ql-editor.ql-blank::before {
                    color: rgba(var(--muted-foreground), 0.6);
                    font-style: normal;
                }
            `}</style>
        </div>
    );
});

export default RichTextEditor;
