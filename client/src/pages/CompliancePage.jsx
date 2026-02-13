import React, { useState } from 'react';
import axios from '../lib/axios';
import { ShieldCheck, AlertTriangle, CheckCircle, ArrowRight, Home } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function CompliancePage() {
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        reporterName: '',
        reporterEmail: '',
        reporterRole: '',
        contentUrl: searchParams.get('url') || '',
        contentType: '',
        reasonCategory: '',
        reasonDescription: '',
        originalSourceUrl: '',
        confirmAccuracy: false,
        confirmPrivacy: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await axios.post('/compliance', formData);
            setIsSuccess(true);
        } catch (err) {
            console.error('Compliance submit error:', err);
            setError(err.response?.data?.error || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.reporterName || !formData.reporterEmail || !formData.reporterRole) {
                setError('Bitte füllen Sie alle Pflichtfelder aus.');
                return;
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.reporterEmail)) {
                setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                return;
            }
        } else if (step === 2) {
            if (!formData.contentUrl || !formData.contentType) {
                setError('Bitte geben Sie die URL und Art des Inhalts an.');
                return;
            }
        } else if (step === 3) {
            if (!formData.reasonCategory || !formData.reasonDescription) {
                setError('Bitte begründen Sie Ihre Meldung.');
                return;
            }
        }
        setError('');
        setStep(step + 1);
    };

    const prevStep = () => {
        setError('');
        setStep(step - 1);
    };

    const inputStyles = "flex h-12 w-full rounded-xl border border-input bg-muted/50 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-background disabled:cursor-not-allowed disabled:opacity-50";

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-primary/20 bg-card/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"
                    >
                        <CheckCircle size={40} />
                    </motion.div>
                    <h1 className="text-2xl font-bold">Vielen Dank!</h1>
                    <p className="text-muted-foreground">
                        Ihre Meldung wurde erfolgreich eingereicht. Wir nehmen das Thema Sicherheit sehr ernst und werden den Fall umgehend prüfen.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Sie erhalten eine Bestätigung an <strong>{formData.reporterEmail}</strong>.
                    </p>
                    <Link to="/">
                        <Button className="w-full mt-4 gap-2">
                            <Home size={16} /> Zurück zur Startseite
                        </Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="max-w-2xl w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                            <ShieldCheck size={32} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold text-foreground">Inhalt melden</h1>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        Helfen Sie uns, GabelGuru sicher zu halten. Nutzen Sie dieses Formular, um rechtswidrige oder unangebrachte Inhalte zu melden.
                    </p>
                </div>

                <Card className="p-6 md:p-8 bg-card shadow-lg border-border">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-primary"
                                initial={{ width: "0%" }}
                                animate={{ width: `${(step / 4) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <span className={step >= 1 ? "text-primary" : ""}>1. Persönliches</span>
                            <span className={step >= 2 ? "text-primary" : ""}>2. Inhalt</span>
                            <span className={step >= 3 ? "text-primary" : ""}>3. Grund</span>
                            <span className={step >= 4 ? "text-primary" : ""}>4. Abschluss</span>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"
                            >
                                <AlertTriangle size={16} />
                                {error}
                            </motion.div>
                        )}

                        {/* Step 1: Reporter Info */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ihr Name / Firmenname *</label>
                                            <Input
                                                value={formData.reporterName}
                                                onChange={e => handleChange('reporterName', e.target.value)}
                                                placeholder="Max Mustermann"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ihre E-Mail-Adresse *</label>
                                            <Input
                                                type="email"
                                                value={formData.reporterEmail}
                                                onChange={e => handleChange('reporterEmail', e.target.value)}
                                                placeholder="name@beispiel.de"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ihre Beziehung zum Inhalt *</label>
                                        <select
                                            value={formData.reporterRole}
                                            onChange={e => handleChange('reporterRole', e.target.value)}
                                            className={inputStyles}
                                        >
                                            <option value="" disabled>Bitte wählen...</option>
                                            <option value="Urheber">Ich bin der Urheber / Rechteinhaber</option>
                                            <option value="Vertreter">Ich vertrete den Rechteinhaber</option>
                                            <option value="Nutzer">Ich bin ein aufmerksamer Nutzer</option>
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Content Info */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Link (URL) zum Inhalt *</label>
                                        <Input
                                            value={formData.contentUrl}
                                            onChange={e => handleChange('contentUrl', e.target.value)}
                                            placeholder="https://gabelguru.de/shared/..."
                                        />
                                        <p className="text-xs text-muted-foreground">Kopieren Sie die genaue Adresse aus der Browserzeile, unter der der Inhalt zu finden ist.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Art des Inhalts *</label>
                                        <select
                                            value={formData.contentType}
                                            onChange={e => handleChange('contentType', e.target.value)}
                                            className={inputStyles}
                                        >
                                            <option value="" disabled>Bitte wählen...</option>
                                            <option value="Text">Text / Rezeptbeschreibung</option>
                                            <option value="Foto">Foto / Bild</option>
                                            <option value="Video">Video</option>
                                            <option value="Nutzername">Nutzername / Profil</option>
                                            <option value="Sonstiges">Sonstiges</option>
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Reason */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Grund der Meldung *</label>
                                        <select
                                            value={formData.reasonCategory}
                                            onChange={e => handleChange('reasonCategory', e.target.value)}
                                            className={inputStyles}
                                        >
                                            <option value="" disabled>Bitte wählen...</option>
                                            <option value="Urheberrechtsverletzung">Urheberrechtsverletzung (Copyright)</option>
                                            <option value="Persönlichkeitsrechtsverletzung">Persönlichkeitsrechtsverletzung</option>
                                            <option value="Beleidigung / Hassrede">Beleidigung / Hassrede</option>
                                            <option value="Gefährliche Inhalte">Gefährliche Inhalte</option>
                                            <option value="Spam / Werbung">Spam / Werbung</option>
                                            <option value="Sonstiges">Sonstiges</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Detaillierte Beschreibung *</label>
                                        <textarea
                                            value={formData.reasonDescription}
                                            onChange={e => handleChange('reasonDescription', e.target.value)}
                                            placeholder="Bitte beschreiben Sie das Problem so genau wie möglich..."
                                            className={cn(inputStyles, "min-h-[150px] resize-y")}
                                        />
                                    </div>
                                    {(formData.reasonCategory === 'Urheberrechtsverletzung') && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Link zum Original (Optional)</label>
                                            <Input
                                                value={formData.originalSourceUrl}
                                                onChange={e => handleChange('originalSourceUrl', e.target.value)}
                                                placeholder="https://mein-blog.de/original-rezept"
                                            />
                                            <p className="text-xs text-muted-foreground">Falls verfügbar, geben Sie hier die Quelle des Originals an.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Confirm & Submit */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-border">
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Zusammenfassung</h3>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="font-semibold">Melder:</span> {formData.reporterName} ({formData.reporterRole})</p>
                                        <p><span className="font-semibold">Inhalt:</span> {formData.contentType} unter <span className="text-primary truncate block">{formData.contentUrl}</span></p>
                                        <p><span className="font-semibold">Grund:</span> {formData.reasonCategory}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id="confirmAccuracy"
                                            checked={formData.confirmAccuracy}
                                            onChange={e => handleChange('confirmAccuracy', e.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor="confirmAccuracy" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                                            Ich versichere, dass die in dieser Meldung enthaltenen Informationen nach bestem Wissen und Gewissen richtig sind. {formData.reporterRole === 'Urheber' && "Ich bin der Inhaber der verletzten Rechte oder handele in dessen Namen."}
                                        </label>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id="confirmPrivacy"
                                            checked={formData.confirmPrivacy}
                                            onChange={e => handleChange('confirmPrivacy', e.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor="confirmPrivacy" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                                            Ich stimme zu, dass meine Daten zur Bearbeitung der Meldung gespeichert und ggf. an den Ersteller des gemeldeten Inhalts weitergegeben werden, sofern dies zur Klärung erforderlich ist (DSA-Compliance).
                                        </label>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-8 border-t border-border mt-8">
                        {step > 1 ? (
                            <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
                                Zurück
                            </Button>
                        ) : (
                            <Link to="/">
                                <Button variant="ghost">Abbrechen</Button>
                            </Link>
                        )}

                        {step < 4 ? (
                            <Button onClick={nextStep}>
                                Weiter <ArrowRight size={16} className="ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !formData.confirmAccuracy || !formData.confirmPrivacy}
                                className={isSubmitting ? "opacity-80" : ""}
                            >
                                {isSubmitting ? (
                                    <>Sende Daten...</>
                                ) : (
                                    <>Meldung absenden <ShieldCheck size={16} className="ml-2" /></>
                                )}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
