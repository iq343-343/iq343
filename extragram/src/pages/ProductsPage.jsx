import React from 'react';
import { motion } from 'framer-motion';

const ProductsPage = () => {
    const products = [
        {
            id: 1,
            name: 'Extragram',
            description: 'Аналитика Telegram-каналов',
            status: 'In Dev',
            color: 'bg-blue-500'
        },
        {
            id: 2,
            name: 'Future Project A',
            description: 'Скоро анонс...',
            status: 'Planned',
            color: 'bg-purple-500'
        },
        {
            id: 3,
            name: 'Future Project B',
            description: 'Скоро анонс...',
            status: 'Planned',
            color: 'bg-emerald-500'
        }
    ];

    return (
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Наши продукты</h2>
                <p className="mt-2 text-lg leading-8 text-slate-400">
                    Инструменты для маркетологов и не только.
                </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                {products.map((product, index) => (
                    <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="flex flex-col overflow-hidden rounded-2xl bg-slate-800/50 ring-1 ring-white/10 hover:ring-blue-500/50 transition-all hover:bg-slate-800"
                    >
                        <div className={`h-2 ${product.color}`} />
                        <div className="p-8">
                            <h3 className="text-lg font-semibold leading-8 text-white">{product.name}</h3>
                            <p className="mt-4 text-base leading-7 text-slate-300">
                                {product.description}
                            </p>
                            <div className="mt-6 flex items-center gap-x-2">
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${product.status === 'In Dev'
                                        ? 'bg-blue-400/10 text-blue-400 ring-blue-400/20'
                                        : 'bg-slate-400/10 text-slate-400 ring-slate-400/20'
                                    }`}>
                                    {product.status}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default ProductsPage;
