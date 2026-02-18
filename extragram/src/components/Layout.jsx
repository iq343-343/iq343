import React from 'react';
import { Sparkles, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Layout = ({ children, currentPage, onNavigate }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const NavLink = ({ page, label }) => (
        <button
            onClick={() => {
                onNavigate(page);
                setIsMobileMenuOpen(false);
            }}
            className={`text-sm font-medium transition-colors hover:text-blue-400 ${currentPage === page ? 'text-blue-400' : 'text-slate-400'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-900 text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Logo */}
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => onNavigate('home')}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                            <Sparkles className="h-5 w-5 text-blue-400" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white">
                            Extragram
                        </span>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        <NavLink page="home" label="Поиск" />
                        <NavLink page="products" label="Продукты" />
                        <a
                            href="/"
                            className="text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 flex items-center gap-1"
                        >
                            На главный сайт
                        </a>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-slate-400 hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Nav */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-b border-slate-800 md:hidden bg-slate-900"
                        >
                            <div className="flex flex-col space-y-4 p-4">
                                <NavLink page="home" label="Поиск" />
                                <NavLink page="products" label="Продукты" />
                                <a
                                    href="/"
                                    className="text-sm font-medium text-slate-400 transition-colors hover:text-blue-400"
                                >
                                    На главный сайт
                                </a>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 bg-slate-950 py-8">
                <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
                    <p>© {new Date().getFullYear()} Extragram. Developed by <a href="/" className="text-blue-500/80 hover:text-blue-400 transition-colors">Extract Studio</a>.</p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
