import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import api from '../lib/axios';
import { tutorialChapters } from '../lib/tutorialSteps';

const TutorialContext = createContext();

export const useTutorial = () => useContext(TutorialContext);

export const TutorialProvider = ({ children }) => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [driverObj, setDriverObj] = useState(null);
    const [activeChapter, setActiveChapter] = useState(() => sessionStorage.getItem('activeTutorialChapter'));
    const [currentStepIndex, setCurrentStepIndex] = useState(() => parseInt(sessionStorage.getItem('tutorialStepIndex') || '0'));
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

    // Global CSS for hiding driver elements during delay
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            body.tutorial-waiting .driver-popover,
            body.tutorial-waiting .driverjs-popover,
            body.tutorial-waiting .driverjs-overlay,
            body.tutorial-waiting .driver-active-element,
            body.tutorial-waiting #driver-popover-item,
            body.tutorial-waiting #driver-page-overlay {
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const saveState = useCallback((chapter, step) => {
        if (chapter) {
            sessionStorage.setItem('activeTutorialChapter', chapter);
            setActiveChapter(chapter);
        } else {
            sessionStorage.removeItem('activeTutorialChapter');
            setActiveChapter(null);
        }

        sessionStorage.setItem('tutorialStepIndex', (step || 0).toString());
        setCurrentStepIndex(step || 0);
    }, []);

    const endTutorial = useCallback(() => {
        if (driverObj) {
            driverObj.destroy();
        }
        setDriverObj(null);
        saveState(null, 0);
        sessionStorage.setItem('tutorialShown', 'true');
    }, [driverObj, saveState]);

    const isVisible = useCallback((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0;
    }, []);

    const findVisibleElement = useCallback((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).find(isVisible);
    }, [isVisible]);

    const waitForElement = useCallback((selector, timeout = 3000, isOptional = false) => {
        const effectiveTimeout = isOptional ? 800 : timeout;
        return new Promise((resolve) => {
            console.log(`Waiting for element: ${selector}${isOptional ? ' (Optional)' : ''}`);
            const el = findVisibleElement(selector);
            if (el) {
                console.log(`Found element immediately: ${selector}`);
                return resolve(el);
            }

            const observer = new MutationObserver(() => {
                const visibleEl = findVisibleElement(selector);
                if (visibleEl) {
                    console.log(`Found element via observer: ${selector}`);
                    observer.disconnect();
                    resolve(visibleEl);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden']
            });

            setTimeout(() => {
                observer.disconnect();
                const finalEl = findVisibleElement(selector);
                console.log(`Finished waiting for ${selector}. Found: ${!!finalEl}`);
                resolve(finalEl);
            }, effectiveTimeout);
        });
    }, [findVisibleElement]);

    const initializeDriver = useCallback((steps) => {
        // Filter steps based on screen size
        const filteredSteps = steps.filter(step => {
            if (step.mobileOnly && window.innerWidth >= 768) return false;
            if (step.desktopOnly && window.innerWidth < 768) return false;
            return true;
        });

        const processedSteps = filteredSteps.map(step => {
            const p = { ...step };
            const isInformational = p.element === 'body' || !p.element || !!p.popover?.image;

            if (p.popover?.image) {
                const base = import.meta.env.BASE_URL.endsWith('/')
                    ? import.meta.env.BASE_URL.slice(0, -1)
                    : import.meta.env.BASE_URL;
                const imgPath = p.popover.image.startsWith('/')
                    ? `${base}${p.popover.image}`
                    : p.popover.image;

                p.popover = {
                    ...p.popover,
                    popoverClass: `${p.popover.popoverClass || ''} tutorial-image-step tutorial-centered-step`.trim(),
                    description: `
                        <div class="tutorial-image-container mb-4 rounded-xl overflow-hidden border border-border/50 bg-muted/30 shadow-inner">
                            <img src="${imgPath}" class="w-full h-auto block" alt="Tutorial" />
                        </div>
                        <div class="tutorial-description-text text-base leading-relaxed">
                            ${p.popover.description || ''}
                        </div>
                    `
                };
            } else if (isInformational) {
                p.popover = {
                    ...p.popover,
                    popoverClass: `${p.popover.popoverClass || ''} tutorial-centered-step`.trim()
                };
            }

            return {
                ...p,
                elementSelector: typeof p.element === 'string' ? p.element : null,
                element: isInformational
                    ? null
                    : (typeof p.element === 'string' ? (() => findVisibleElement(p.element)) : p.element)
            };
        });

        const d = driver({
            showProgress: true,
            allowClose: false,
            overlayClickable: false,
            keyboardControl: false, // Prevents ESC from closing
            smoothScroll: true,
            onPopoverRender: (popover) => {
                // 1. Button wieder sichtbar machen
                popover.closeButton.style.display = 'block';

                // 2. Sicherstellen, dass er die Tour auch wirklich beendet
                popover.closeButton.addEventListener('click', () => {
                    saveState(null, 0); // Clear state before destruction
                    // Try to cleanly invoke destroy. Due to driver.js internals we might just use d.destroy()
                    try { d.destroy(); } catch (e) { }
                    setDriverObj(null);
                });
            },
            nextBtnText: 'Weiter',
            prevBtnText: 'Zurück',
            doneBtnText: 'Kapitelauswahl',
            progressText: '{{current}} von {{total}}',
            overlayColor: 'rgba(0,0,0,0.8)',
            steps: processedSteps,
            onHighlightStarted: (element, step) => {
                const index = filteredSteps.indexOf(step);
                setCurrentStepIndex(index);

                if (step.delay && d) {
                    document.body.classList.add('tutorial-waiting');
                    setTimeout(() => {
                        try {
                            document.body.classList.remove('tutorial-waiting');
                            d.refresh();
                        } catch (e) {
                            console.warn('Failed to refresh driver after delay', e);
                        }
                    }, step.delay);
                }

                if (step.popover?.triggerModal) {
                    window.dispatchEvent(new CustomEvent('tutorial-trigger-modal', { detail: step.popover.triggerModal }));
                }
                if (step.disableInteraction && element) {
                    element.classList.add('pointer-events-none');
                    element.setAttribute('inert', 'true');
                }
            },
            onDeselected: (element, step) => {
                // Only update the state if we are actually still in a tutorial chapter
                const currentChapter = sessionStorage.getItem('activeTutorialChapter');
                if (currentChapter) {
                    const index = filteredSteps.indexOf(step);
                    saveState(currentChapter, index + 1);
                }
                if (step.disableInteraction && element) {
                    element.classList.remove('pointer-events-none');
                    element.removeAttribute('inert');
                }
            },
            onDestroyed: () => {
                const currentChapterKey = sessionStorage.getItem('activeTutorialChapter');
                if (currentChapterKey) {
                    const chapter = tutorialChapters[currentChapterKey];
                    if (chapter?.finalRedirect) {
                        navigate(chapter.finalRedirect);
                    }
                    setIsWelcomeOpen(true);
                }

                saveState(null, 0);
                setDriverObj(null);
            }
        });

        // Wrap drive method to wait for first element if it's a string selector
        const originalDrive = d.drive.bind(d);
        d.drive = async (stepIndex) => {
            let currentIdx = stepIndex || 0;
            let firstStep = processedSteps[currentIdx];

            // Skip optional steps that are not found immediately on start
            while (firstStep && firstStep.isOptional && firstStep.elementSelector) {
                const found = await waitForElement(firstStep.elementSelector, 800, true);
                if (found) break;
                currentIdx++;
                firstStep = processedSteps[currentIdx];
            }

            const selector = firstStep?.elementSelector;
            if (selector) {
                await waitForElement(selector);
            }
            originalDrive(currentIdx);
        };

        setDriverObj(d);
        return d;
    }, [activeChapter, saveState, waitForElement]);

    // Global Reactive Chapter Start
    useEffect(() => {
        // Ensure that sessionStorage physically has an active chapter. If not, don't start.
        if (activeChapter && !driverObj && sessionStorage.getItem('activeTutorialChapter') !== null) {
            const chapter = tutorialChapters[activeChapter];
            if (!chapter) return;

            const targetPath = chapter.page?.replace(':id', '');

            // Check if we are on the correct page
            // We use a simple startsWith for detail pages or exact match
            const isCorrectPage = !chapter.page ||
                location.pathname === targetPath ||
                (chapter.page.includes(':id') && location.pathname.startsWith(chapter.page.split('/:id')[0]));

            if (isCorrectPage) {
                console.log(`Auto-starting tutorial chapter: ${activeChapter} on page: ${location.pathname}`);
                const startStep = parseInt(sessionStorage.getItem('tutorialStepIndex') || '0');
                const d = initializeDriver(chapter.steps);
                d.drive(startStep);
            }
        }
    }, [activeChapter, driverObj, initializeDriver, location.pathname]);

    const notifyAction = useCallback(async (actionType, payload = {}) => {
        if (!driverObj || !activeChapter) return;

        const currentStep = driverObj.getActiveStep();
        if (currentStep && (currentStep.popover?.actionRequirement === actionType || currentStep.actionRequirement === actionType)) {
            // Check payload if necessary
            if (payload.value && currentStep.popover?.actionValue && payload.value !== currentStep.popover.actionValue) {
                return;
            }

            console.log(`Tutorial action met: ${actionType}`);

            const steps = driverObj.getConfig().steps;
            const currentIndex = driverObj.getActiveIndex();
            let nextStepIndex = currentIndex + 1;
            let nextStep = steps[nextStepIndex];

            // Skip optional steps if their element is not found
            while (nextStep && nextStep.isOptional && nextStep.elementSelector) {
                const found = await waitForElement(nextStep.elementSelector, 800, true);
                if (found) break;
                console.log(`Skipping optional step: ${nextStep.elementSelector}`);
                nextStepIndex++;
                nextStep = steps[nextStepIndex];
            }

            if (nextStep?.elementSelector) {
                await waitForElement(nextStep.elementSelector);
            }

            // Waiting for animations or settling if nextStep wants it
            if (nextStep?.delay) {
                await new Promise(r => setTimeout(r, nextStep.delay));
            } else if (nextStep) {
                // Give a tiny default breathing room for new DOM elements
                await new Promise(r => setTimeout(r, 100));
            }

            if (nextStepIndex > currentIndex + 1) {
                driverObj.drive(nextStepIndex);
            } else {
                driverObj.moveNext();
            }
        }
    }, [driverObj, activeChapter, waitForElement]);

    const handleStartChapter = useCallback(async (chapterId, startStep = 0) => {
        setIsWelcomeOpen(false);

        if (driverObj) {
            driverObj.destroy();
            setDriverObj(null);
        }

        const chapter = tutorialChapters[chapterId];
        if (!chapter) return;

        let targetPath = chapter.page?.replace(':id', '');

        // Handle dynamic paths like /lists/:id
        if (chapter.page?.includes(':id')) {
            try {
                const { data } = await api.get('/lists');
                if (data && data.length > 0) {
                    targetPath = chapter.page.replace(':id', data[0].id);
                } else {
                    alert('Dieses Tutorial benötigt eine existierende Einkaufsliste. Bitte erstelle erst eine Liste.');
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch lists for tutorial', err);
                return;
            }
        }

        saveState(chapterId, startStep);

        if (!targetPath || location.pathname === targetPath) {
            const d = initializeDriver(chapter.steps);
            d.drive(startStep);
        } else {
            navigate(targetPath);
        }
    }, [saveState, initializeDriver, location.pathname, navigate, driverObj]);

    const handleToggleShowTutorial = useCallback(async (value) => {
        try {
            const { data } = await api.put('/auth/profile', { showAppTutorial: value });
            setUser(data);
        } catch (err) {
            console.error('Failed to update tutorial setting', err);
        }
    }, [setUser]);

    const startChapter = useCallback((chapterId, startStep = 0) => {
        handleStartChapter(chapterId, startStep);
    }, [handleStartChapter]);

    return (
        <TutorialContext.Provider value={{
            activeChapter,
            currentStepIndex,
            startChapter,
            endTutorial,
            notifyAction,
            initializeDriver,
            driverObj,
            isWelcomeOpen,
            setIsWelcomeOpen,
            handleStartChapter,
            handleToggleShowTutorial
        }}>
            {children}
        </TutorialContext.Provider>
    );
};
