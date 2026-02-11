import React, { useState } from 'react';
import { MCQResult, User } from '../types';
import { X, TrendingUp, BookOpen, AlertCircle, CheckCircle, BarChart3, Maximize2, Minimize2, ArrowRight } from 'lucide-react';

interface Props {
  history: MCQResult[];
  user: User;
  onViewNotes?: (topic: string) => void;
}

export const PerformanceGraph: React.FC<Props> = ({ history, user, onViewNotes }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  // Prepare Data
  const recentHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const graphData = recentHistory.slice(0, 10).reverse().map(h => ({
      score: h.totalQuestions > 0 ? Math.round((h.score / h.totalQuestions) * 100) : 0,
      title: h.chapterTitle,
      date: new Date(h.date).toLocaleDateString(),
      id: h.id
  }));

  const renderGraph = (height: number = 100) => {
      if (graphData.length === 0) return <p className="text-center text-xs text-slate-400 py-4">No test data available.</p>;

      return (
          <div className="w-full relative" style={{ height: `${height}px` }}>
              <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-300 pointer-events-none">
                  <div className="border-b border-slate-100 w-full h-0"></div>
                  <div className="border-b border-slate-100 w-full h-0"></div>
                  <div className="border-b border-slate-100 w-full h-0"></div>
                  <div className="border-b border-slate-100 w-full h-0"></div>
              </div>

              <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                      </linearGradient>
                  </defs>

                  <path
                      d={`M0,100 ` + graphData.map((d, i) => {
                          const x = (i / (Math.max(1, graphData.length - 1))) * 100;
                          const y = 100 - d.score;
                          return `L${x},${y}`;
                      }).join(' ') + ` L100,100 Z`}
                      fill="url(#gradient)"
                  />

                  <polyline
                      points={graphData.map((d, i) => {
                          const x = (i / (Math.max(1, graphData.length - 1))) * 100;
                          const y = 100 - d.score;
                          return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                  />

                  {graphData.map((d, i) => {
                      const x = (i / (Math.max(1, graphData.length - 1))) * 100;
                      const y = 100 - d.score;
                      return (
                          <g key={i} className="group cursor-pointer">
                              <circle cx={`${x}%`} cy={`${y}%`} r="3" fill="#3b82f6" className="group-hover:r-5 transition-all" />
                              <foreignObject x={`${x}%`} y={`${y}%`} width="100" height="50" style={{overflow: 'visible'}}>
                                  <div className="transform -translate-x-1/2 -translate-y-full pb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                          {d.score}% - {d.title}
                                      </div>
                                  </div>
                              </foreignObject>
                          </g>
                      );
                  })}
              </svg>
          </div>
      );
  };

  const renderDetailedView = () => {
      const selectedTest = selectedTestId ? recentHistory.find(h => h.id === selectedTestId) : recentHistory[0];

      return (
          <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in">
              <div className="bg-white p-4 shadow-sm border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
                  <div>
                      <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                          <BarChart3 className="text-blue-600" /> Performance Analysis
                      </h2>
                      <p className="text-xs text-slate-500">Detailed breakdown of your test history</p>
                  </div>
                  <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-slate-100 rounded-full bg-white border border-slate-200">
                      <X size={20} />
                  </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                  {/* Sidebar List */}
                  <div className="w-full md:w-80 bg-white border-r border-slate-200 overflow-y-auto">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-xs text-slate-500 uppercase">
                          Recent Tests
                      </div>
                      {recentHistory.map(test => (
                          <button
                              key={test.id}
                              onClick={() => setSelectedTestId(test.id)}
                              className={`w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors flex justify-between items-center ${selectedTestId === test.id || (!selectedTestId && recentHistory[0].id === test.id) ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                          >
                              <div className="overflow-hidden">
                                  <p className="font-bold text-slate-800 text-sm truncate">{test.chapterTitle}</p>
                                  <p className="text-xs text-slate-500">{new Date(test.date).toLocaleDateString()} • {test.subjectName}</p>
                              </div>
                              <span className={`text-xs font-bold px-2 py-1 rounded ${test.score/test.totalQuestions >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {Math.round((test.score/test.totalQuestions)*100)}%
                              </span>
                          </button>
                      ))}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-8">
                      {selectedTest ? (
                          <div className="max-w-3xl mx-auto space-y-6">
                              {/* Header Card */}
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                                  <div>
                                      <h3 className="text-2xl font-black text-slate-800 mb-1">{selectedTest.chapterTitle}</h3>
                                      <div className="flex gap-3 text-xs font-bold text-slate-500">
                                          <span className="flex items-center gap-1"><BookOpen size={14} /> {selectedTest.subjectName}</span>
                                          <span className="flex items-center gap-1"><TrendingUp size={14} /> {selectedTest.totalQuestions} Questions</span>
                                      </div>
                                  </div>
                                  <div className="text-center">
                                      <div className={`text-4xl font-black ${selectedTest.score/selectedTest.totalQuestions >= 0.8 ? 'text-green-500' : 'text-orange-500'}`}>
                                          {Math.round((selectedTest.score / selectedTest.totalQuestions) * 100)}%
                                      </div>
                                      <p className="text-xs text-slate-400 font-bold uppercase">Overall Score</p>
                                  </div>
                              </div>

                              {/* Topic Breakdown */}
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                      <TrendingUp size={18} className="text-purple-600"/> Topic Breakdown
                                  </h4>

                                  {/* Since MCQResult doesn't store per-test topic breakdown explicitly unless we parse it from history or questions,
                                      we will simulate it from global topic strength or assume simple breakdown if data missing.
                                      However, the prompt asks to show "kon mcq me kitna topic tha...".
                                      Ideally, we need this data. But `MCQResult` schema has `wrongQuestions`.
                                      We can infer topics from `wrongQuestions` and assume others were correct? No, that's partial.

                                      Let's use a mock breakdown if actual data isn't in MCQResult, OR improved logic:
                                      We can't retroactively get topics for old tests.
                                      For now, we will show a placeholder or use `topicStrength` (Global) filtered by subject.

                                      Actually, user said "kon topic se kon kon questions mistake hua hai".
                                      We HAVE `wrongQuestions` which contains `question`, `explanation` and we can parse `Topic` from explanation/question if needed or if saved.
                                      The Admin Dashboard saves `topic` in `wrongQuestions`? No, let's check McqView.
                                      McqView saves: `wrongQuestions: [{question, qIndex, explanation}]`.
                                      It DOES NOT save topic in `wrongQuestions`.

                                      Wait, `user.topicStrength` is updated.
                                      But for *this specific test*, we don't have the map.

                                      I will show `wrongQuestions` as "Weak Areas" and allow viewing notes.
                                  */}

                                  {selectedTest.wrongQuestions && selectedTest.wrongQuestions.length > 0 ? (
                                      <div className="space-y-3">
                                          {selectedTest.wrongQuestions.map((q: any, i: number) => (
                                              <div key={i} className="p-3 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
                                                  <div>
                                                      <p className="font-bold text-red-800 text-xs mb-1">Mistake #{i+1}</p>
                                                      <p className="text-xs text-slate-700 line-clamp-1">{q.question}</p>
                                                  </div>
                                                  {onViewNotes && (
                                                      <button
                                                          onClick={() => onViewNotes(q.topic || selectedTest.chapterTitle)} // Fallback to chapter title
                                                          className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1"
                                                      >
                                                          <BookOpen size={12} /> Notes
                                                      </button>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="text-center py-8 text-green-600 font-bold bg-green-50 rounded-xl border border-green-100">
                                          <CheckCircle size={32} className="mx-auto mb-2" />
                                          <p>Perfect Score! No weak topics found.</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-20 text-slate-400">Select a test to view details</div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  return (
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 relative overflow-hidden group">
          {isFullScreen && renderDetailedView()}

          <div className="flex justify-between items-end mb-4">
              <div>
                  <h3 className="font-black text-slate-800 text-lg">Performance</h3>
                  <p className="text-xs text-slate-500 font-medium">Last 10 Tests Trend</p>
              </div>
              <button
                  onClick={() => setIsFullScreen(true)}
                  className="bg-blue-50 text-blue-600 p-2 rounded-xl hover:bg-blue-100 transition-colors"
                  title="Full Screen Analysis"
              >
                  <Maximize2 size={18} />
              </button>
          </div>

          <div className="h-32 mb-2">
              {renderGraph(128)}
          </div>

          {recentHistory.length > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs font-bold text-slate-600">
                      Last: {recentHistory[0].score}/{recentHistory[0].totalQuestions}
                  </div>
                  <div className={`text-xs font-black px-2 py-0.5 rounded ${
                      recentHistory[0].score/recentHistory[0].totalQuestions >= 0.8 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                      {recentHistory[0].performanceTag || 'AVERAGE'}
                  </div>
              </div>
          )}
      </div>
  );
};
