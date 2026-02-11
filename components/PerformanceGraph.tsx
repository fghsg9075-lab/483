import React, { useState, useMemo } from 'react';
import { User, MCQResult } from '../types';
import { BarChart3, Maximize2, X, ChevronRight, TrendingUp, AlertCircle, BookOpen } from 'lucide-react';

interface Props {
    user: User;
    onViewNotes?: (topic: string) => void;
    onViewAnalytics?: () => void;
}

export const PerformanceGraph: React.FC<Props> = ({ user, onViewNotes, onViewAnalytics }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

    // Get last 5 tests for the mini-graph
    const recentTests = useMemo(() => {
        return (user.mcqHistory || []).slice(0, 5).reverse();
    }, [user.mcqHistory]);

    // Calculate Global Topic Strength (since per-test might be missing)
    const topicStrength = user.topicStrength || {};
    const sortedTopics = Object.entries(topicStrength).sort(([,a], [,b]) => {
        const pctA = a.total > 0 ? (a.correct / a.total) : 0;
        const pctB = b.total > 0 ? (b.correct / b.total) : 0;
        return pctA - pctB; // Ascending (Weakest first)
    });

    const getBarColor = (score: number) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 50) return 'bg-blue-500';
        return 'bg-red-500';
    };

    if (!user.mcqHistory || user.mcqHistory.length === 0) {
        return (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center h-48">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <BarChart3 className="text-slate-400" />
                </div>
                <p className="font-bold text-slate-600 text-sm">No Test Data Available</p>
                <p className="text-xs text-slate-400 mt-1">Take a test to see your performance graph.</p>
            </div>
        );
    }

    // MINI GRAPH VIEW
    if (!isFullScreen) {
        return (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <TrendingUp className="text-blue-600" size={20} /> Performance
                        </h3>
                        <p className="text-xs text-slate-500 font-bold">Last 5 Tests Analysis</p>
                    </div>
                    <button
                        onClick={() => setIsFullScreen(true)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>

                <div className="flex items-end justify-between gap-2 h-32 pt-4">
                    {recentTests.map((test, i) => {
                        const pct = test.totalQuestions > 0 ? Math.round((test.score / test.totalQuestions) * 100) : 0;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="text-[10px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-6">
                                    {pct}%
                                </div>
                                <div className="w-full bg-slate-100 rounded-t-lg relative h-full flex items-end overflow-hidden group-hover:bg-slate-200 transition-colors">
                                    <div
                                        className={`w-full ${getBarColor(pct)} transition-all duration-1000 ease-out rounded-t-lg opacity-80 group-hover:opacity-100`}
                                        style={{ height: `${pct}%` }}
                                    ></div>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">
                                    {test.chapterTitle.slice(0, 6)}..
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // FULL SCREEN VIEW
    return (
        <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white px-4 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">Performance Analysis</h2>
                    <p className="text-xs text-slate-500 font-bold">Detailed Report & Topic Breakdown</p>
                </div>
                <div className="flex items-center gap-2">
                    {onViewAnalytics && (
                        <button
                            onClick={() => {
                                setIsFullScreen(false);
                                onViewAnalytics();
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <BarChart3 size={16} /> Full Report
                        </button>
                    )}
                    <button
                        onClick={() => setIsFullScreen(false)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* LEFT COLUMN: TEST LIST */}
                    <div className="space-y-4">
                        <h3 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                            <BarChart3 size={16} /> All Test Results
                        </h3>
                        <div className="space-y-3">
                            {user.mcqHistory?.map((test) => {
                                const pct = test.totalQuestions > 0 ? Math.round((test.score / test.totalQuestions) * 100) : 0;
                                const isSelected = selectedTestId === test.id;

                                return (
                                    <button
                                        key={test.id}
                                        onClick={() => setSelectedTestId(isSelected ? null : test.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all ${isSelected ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{test.chapterTitle}</h4>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(test.date).toLocaleDateString()} • {test.totalQuestions} Questions
                                                </p>
                                            </div>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                {pct}%
                                            </span>
                                        </div>

                                        {/* EXPANDED DETAILS FOR SELECTED TEST */}
                                        {isSelected && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Score</p>
                                                        <p className="font-black text-slate-800">{test.score}</p>
                                                    </div>
                                                    <div className="bg-red-50 p-2 rounded-lg text-center">
                                                        <p className="text-[10px] text-red-400 uppercase font-bold">Mistakes</p>
                                                        <p className="font-black text-red-700">{test.wrongCount}</p>
                                                    </div>
                                                    <div className="bg-green-50 p-2 rounded-lg text-center">
                                                        <p className="text-[10px] text-green-400 uppercase font-bold">Correct</p>
                                                        <p className="font-black text-green-700">{test.correctCount}</p>
                                                    </div>
                                                </div>

                                                {/* WRONG QUESTIONS LIST (Since we might not have full topic breakdown per test) */}
                                                {test.wrongQuestions && test.wrongQuestions.length > 0 ? (
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Mistakes Analysis</p>
                                                        {test.wrongQuestions.map((wq, idx) => (
                                                            <div key={idx} className="bg-red-50 p-3 rounded-xl border border-red-100">
                                                                <p className="text-xs font-bold text-red-800 mb-1">Q{wq.qIndex + 1}</p>
                                                                <div className="text-[10px] text-slate-700" dangerouslySetInnerHTML={{ __html: wq.question }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic text-center">No mistakes recorded or perfect score!</p>
                                                )}

                                                {/* CTA TO FULL ANALYSIS */}
                                                {onViewAnalytics && (
                                                    <button
                                                        onClick={() => {
                                                            setIsFullScreen(false);
                                                            onViewAnalytics(); // Ideally pass test ID but Analytics Page handles selection well enough
                                                        }}
                                                        className="w-full mt-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 flex items-center justify-center gap-2"
                                                    >
                                                        <BarChart3 size={14} /> View Detailed Solution
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: GLOBAL TOPIC BREAKDOWN */}
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                                <AlertCircle size={16} className="text-orange-500" /> Overall Topic Strength
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">Based on your performance across all tests.</p>

                            {sortedTopics.length > 0 ? (
                                <div className="space-y-3">
                                    {sortedTopics.map(([topic, stats]) => {
                                        const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                                        return (
                                            <div key={topic} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-slate-700 text-xs truncate max-w-[60%]">{topic}</span>
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                        {pct}% Score
                                                    </span>
                                                </div>

                                                {/* PROGRESS BAR */}
                                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-3">
                                                    <div
                                                        className={`h-full ${getBarColor(pct)}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>

                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-400">
                                                        {stats.total - stats.correct} Mistakes / {stats.total} Qs
                                                    </span>

                                                    {onViewNotes && (
                                                        <button
                                                            onClick={() => onViewNotes(topic)}
                                                            className="text-[9px] font-bold bg-white border border-slate-200 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 flex items-center gap-1 transition-colors"
                                                        >
                                                            <BookOpen size={10} /> View Notes
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-sm font-bold">No Topic Data Yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
