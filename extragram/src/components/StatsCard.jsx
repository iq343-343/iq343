import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Users, Eye, TrendingUp, Heart, CheckCircle2 } from 'lucide-react';

const StatsCard = ({ data }) => {
    if (!data) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-10 w-full max-w-4xl mx-auto text-left"
        >
            {/* Channel Header */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 mb-8 ring-1 ring-white/10 flex flex-col md:flex-row items-center gap-8">
                {data.avatar && (
                    <div className="relative">
                        <img
                            src={data.avatar}
                            alt={data.title}
                            className="w-24 h-24 rounded-2xl object-cover ring-2 ring-blue-500/20 shadow-2xl shadow-blue-500/10"
                        />
                        {data.isVerified && (
                            <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 shadow-lg">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                        )}
                    </div>
                )}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <h2 className="text-2xl font-bold text-white leading-tight">
                            {data.title || data.username}
                        </h2>
                        {data.isVerified && <CheckCircle2 className="hidden md:block w-5 h-5 text-blue-400" />}
                    </div>
                    <div className="text-blue-400 font-medium mb-3">{data.username}</div>
                    {data.description && (
                        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                            {data.description}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {/* Subscribers */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg">
                            <Users className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Подписчики</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.subscribers.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1">
                        <TrendingUp size={10} />
                        +{data.growthToday.toLocaleString()} сегодня
                    </div>
                </div>

                {/* Views */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-purple-500/10 rounded-lg">
                            <Eye className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Ср. просмотры</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.avgViews.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">
                        ERR: {data.subscribers > 0 ? ((data.avgViews / data.subscribers) * 100).toFixed(1) : 0}%
                    </div>
                </div>

                {/* Reactions */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-rose-500/10 rounded-lg">
                            <Heart className="w-4 h-4 text-rose-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Ср. реакции</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.avgReactions ? data.avgReactions.toLocaleString() : '0'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">
                        По 10 постам
                    </div>
                </div>

                {/* Growth (30 days) */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">Рост (30 дн)</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        +{data.growthMonth.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-2">
                        {(data.growthMonth / (data.subscribers - data.growthMonth) * 100).toFixed(1)}% за месяц
                    </div>
                </div>
            </div>

            {/* Graph */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 ring-1 ring-white/10 h-[400px]">
                <h3 className="text-lg font-semibold text-white mb-6">Динамика роста подписчиков</h3>
                <ResponsiveContainer width="100%" height="85%">
                    <AreaChart data={data.history}>
                        <defs>
                            <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="subscribers"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorPv)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default StatsCard;
