import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { checkChannel } from '../services/api';

const HomePage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);
        setData(null);

        try {
            const result = await checkChannel(searchQuery);
            setData(result);
        } catch (err) {
            if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
                setError('Канал не найден. Проверьте правильность написания или попробуйте другой.');
            } else {
                setError('Произошла ошибка при загрузке данных. Попробуйте еще раз позже.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative isolate overflow-hidden min-h-[calc(100vh-80px)]">
            {/* Background gradients */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 blur-3xl opacity-20 w-[600px] h-[600px] bg-blue-600 rounded-full" />
            </div>

            <div className="mx-auto max-w-7xl px-6 py-12 sm:py-24 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <AnimatePresence mode="wait">
                        {!data && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="mb-12"
                            >
                                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6">
                                    Аналитика телеграм каналов
                                    <span className="block text-blue-400 mt-2 text-2xl sm:text-4xl">быстро и просто</span>
                                </h1>
                                <p className="text-lg leading-8 text-slate-300">
                                    Проверьте статистику любого канала за считанные секунды.<br />Подписчики, просмотры и динамика роста.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Search Section */}
                    <motion.div
                        layout
                        className="w-full max-w-md mx-auto relative z-10"
                    >
                        <form onSubmit={handleSearch} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500" />
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="@username или ссылка"
                                    className="w-full rounded-xl border-0 bg-slate-900/80 px-4 py-4 pl-12 text-white shadow-xl ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 outline-none backdrop-blur-xl"
                                    disabled={isLoading}
                                />
                                <Search className="absolute left-4 w-5 h-5 text-slate-500" />
                                <button
                                    type="submit"
                                    disabled={isLoading || !searchQuery}
                                    className="absolute right-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Проверить'}
                                </button>
                            </div>
                        </form>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium backdrop-blur-md"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Results Section */}
                    <AnimatePresence>
                        {data && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <StatsCard data={data} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
