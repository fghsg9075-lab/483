import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { BarChart3, Maximize2, X, TrendingUp, AlertCircle, BookOpen, Target, CheckCircle, Clock } from 'lucide-react';

interface Props {
    history: any[];
    user: User;
    onViewNotes?: (topic: string) => void;
    onViewAnalytics?: () => void;
}

export const PerformanceGraph: React.FC<Props> = ({ history, user, onViewNotes, onViewAnalytics }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

    // Stats Calculation
    const stats = useMemo(() => {
        if (!history || history.length === 0) return null;

        const totalTests = history.length;
        const totalQs = history.reduce((acc, t) => acc + (t.totalQuestions || 0), 0);
        const totalCorrect = history.reduce((acc, t) => acc + (t.correctCount || 0), 0);
        const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;

        const avgScore = Math.round(history.reduce((acc, t) => acc + (t.totalQuestions > 0 ? (t.score / t.totalQuestions) * 100 : 0), 0) / totalTests);

        // Topic Breakdown (Global)
        const topicMap: Record<string, { total: number, correct: number }> = {};
        history.forEach(t => {
            // If test has topic breakdown, use it (if available in future)
            // Fallback to global user topicStrength if strictly needed, but let's try to derive or use what we have.
            // Current data structure only stores global topicStrength in user object, not per test detailed history usually.
            // We'll use user.topicStrength.
        });

        return { totalTests, accuracy, avgScore };
    }, [history]);

    const topicStrength = user.topicStrength || {};
    const sortedTopics = Object.entries(topicStrength).sort(([,a], [,b]) => {
        const pctA = a.total > 0 ? (a.correct / a.total) : 0;
        const pctB = b.total > 0 ? (b.correct / b.total) : 0;
        return pctA - pctB; // Weakest first
    });

    // Donut Chart Helper
    const renderDonut = (percent: number, size: number, strokeWidth: number, color: string) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percent / 100) * circumference;

        return (
            <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#f1f5f9"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-black text-slate-800" style={{ fontSize: size * 0.25 }}>{percent}%</span>
                </div>
            </div>
        );
    };

    if (!stats) {
        return (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={20} /></div>
                        <div><h3 className="font-black text-slate-800 leading-none">Analytics</h3><p className="text-[10px] text-slate-400 font-bold mt-0.5">Overview</p></div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center text-center h-32">
                    <div className="bg-slate-50 p-3 rounded-full mb-2"><BarChart3 className="text-slate-400" size={20} /></div>
                    <p className="font-bold text-slate-600 text-xs">No Data Yet</p>
                    <p className="text-[10px] text-slate-400">Take a test to see analysis</p>
                </div>
            </div>
        );
    }

    // FULL SCREEN MODAL
    if (isFullScreen) {
        return (
            <div className="fixed inset-0 z-[250] bg-slate-50 flex flex-col animate-in fade-in duration-200">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Performance Analytics</h2>
                        <p className="text-xs text-slate-500 font-bold">Detailed Report & Insights</p>
                    </div>
                    <button
                        onClick={() => setIsFullScreen(false)}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* TOP STATS ROW */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            {renderDonut(stats.accuracy, 60, 6, stats.accuracy >= 80 ? '#22c55e' : stats.accuracy >= 50 ? '#3b82f6' : '#ef4444')}
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">Overall Accuracy</p>
                                <p className="text-lg font-black text-slate-800">{stats.accuracy >= 80 ? 'Excellent' : stats.accuracy >= 50 ? 'Good' : 'Needs Work'}</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <Target size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">Avg Score</p>
                                <p className="text-2xl font-black text-slate-800">{stats.avgScore}%</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">Tests Taken</p>
                                <p className="text-2xl font-black text-slate-800">{stats.totalTests}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* TOPIC STRENGTH */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-600" /> Topic Strength
                            </h3>
                            <div className="space-y-4">
                                {sortedTopics.length > 0 ? sortedTopics.map(([topic, data]) => {
                                    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                                    return (
                                        <div key={topic} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-slate-700">{topic}</span>
                                                <span className={pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-blue-600' : 'text-red-500'}>{pct}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-center text-slate-400 text-sm py-10">No topic data available yet.</p>
                                )}
                            </div>
                        </div>

                        {/* RECENT TESTS */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-orange-600" /> Recent Activity
                            </h3>
                            <div className="space-y-3">
                                {history.slice().reverse().map((test: any) => (
                                    <div key={test.id} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{test.chapterTitle}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(test.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-lg font-black ${test.score >= 80 ? 'text-green-600' : 'text-blue-600'}`}>
                                                {test.score}%
                                            </span>
                                            <p className="text-[10px] text-slate-400">{test.correctCount}/{test.totalQuestions} Correct</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // MINI DASHBOARD CARD
    return (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 leading-none">Analytics</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Overview</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsFullScreen(true)}
                    className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    View Report
                </button>
            </div>

            <div className="flex items-center gap-6">
                {/* LEFT: BIG ACCURACY CIRCLE */}
                <div className="flex-shrink-0">
                    {renderDonut(stats.accuracy, 100, 10, stats.accuracy >= 80 ? '#22c55e' : stats.accuracy >= 50 ? '#3b82f6' : '#ef4444')}
                </div>

                {/* RIGHT: STATS GRID */}
                <div className="grid grid-cols-2 gap-3 flex-1">
                    <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Tests</p>
                        <p className="text-xl font-black text-slate-800">{stats.totalTests}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Score</p>
                        <p className="text-xl font-black text-slate-800">{stats.avgScore}%</p>
                    </div>
                    <div className="col-span-2 bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Status</p>
                            <p className="text-sm font-black text-slate-800">{stats.accuracy >= 80 ? 'Top Performer 🏆' : stats.accuracy >= 50 ? 'On Track 🚀' : 'Keep Pushing 💪'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
