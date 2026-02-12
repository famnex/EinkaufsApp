import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

export default function PublicLayout({ children, mainClassName = "flex-1 pt-16" }) {
    return (
        <div className="min-h-screen bg-background font-['Outfit'] overflow-x-hidden selection:bg-primary/20 flex flex-col">
            <PublicHeader />
            <main className={mainClassName}>
                {children}
            </main>
            <PublicFooter />
        </div>
    );
}
