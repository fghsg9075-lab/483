import React, { useState, useEffect } from 'react';
import { LessonContent, User, SystemSettings, UsageHistoryEntry, SubscriptionHistoryEntry } from '../types';
import { BookOpen, Calendar, ChevronDown, Trash2, Search, FileText, CheckCircle2, AlertCircle, Folder, History, CreditCard, LogIn, Clock, DollarSign, Crown } from 'lucide-react';
import { LessonView } from './LessonView';
import { saveUserToLive } from '../firebase';
import { CustomAlert, CustomConfirm } from './CustomDialogs';

interface Props {
    user: User;
    onUpdateUser: (u: User) => void;
    settings?: SystemSettings;
}

export const HistoryPage: React.FC<Props> = ({ user, onUpdateUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'STUDY' | 'TRANSACTIONS' | 'LOGINS' | 'SAVED'>('STUDY');
  
  // SAVED NOTES STATE
  const [history, setHistory] = useState<LessonContent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  
  // USAGE HISTORY STATE (ACTIVITY LOG)
  const [usageLog, setUsageLog] = useState<UsageHistoryEntry[]>([]);

  // ONLINE DURATION HISTORY (From LocalStorage)
  const [onlineHistory, setOnlineHistory] = useState<{date: string, seconds: number}[]>([]);

  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
      isOpen: false, 
      message: '', 
      onConfirm: () => {}
  });

  useEffect(() => {
    // Load Saved Notes
    const stored = localStorage.getItem('nst_user_history');
    if (stored) {
        try {
            setHistory(JSON.parse(stored).reverse()); // Newest first
        } catch (e) { console.error("History parse error", e); }
    }

    // Load Activity Log from User Object
    if (user.usageHistory) {
        setUsageLog([...user.usageHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    // Load Online Duration History from LocalStorage
    const durationLogs: {date: string, seconds: number}[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`activity_${user.id}_`)) {
            const dateStr = key.replace(`activity_${user.id}_`, '');
            const seconds = parseInt(localStorage.getItem(key) || '0');
            if (seconds > 0) {
                durationLogs.push({ date: dateStr, seconds });
            }
        }
    }
    // Sort by Date Descending
    durationLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setOnlineHistory(durationLogs);

  }, [user.usageHistory, user.id]);

  const checkAvailability = (log: any) => {
    if (log.videoUrl || log.pdfUrl || log.content) return true;
    if (!settings?.subjects) return true;
    const subjectData = settings.subjects.find(s => s.name === log.subject);
    if (!subjectData) return false;
    const chapters = subjectData.chapters || [];
    const chapter = chapters.find(c => c.title === log.itemTitle || c.id === log.itemId);
    if (!chapter) return false;
    if (log.type === 'VIDEO') return !!chapter.videoPlaylist;
    if (log.type === 'PDF') return !!chapter.pdfLink;
    return true;
  };

  const executeOpenItem = (item: LessonContent, cost: number) => {
      if (cost > 0) {
          const updatedUser: any = { ...user, credits: user.credits - cost };
          onUpdateUser(updatedUser);
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser);
      }
      setSelectedLesson(item);
  };

  const handleOpenItem = (item: LessonContent) => {
      let cost = 0;
      if (item.type.includes('MCQ')) {
          cost = settings?.mcqHistoryCost ?? 1;
      } else if (item.type === 'VIDEO_LECTURE') {
          cost = settings?.videoHistoryCost ?? 2;
      } else if (item.type === 'NOTES_SIMPLE' || item.type === 'NOTES_PREMIUM') {
          cost = settings?.pdfHistoryCost ?? 1;
      }
      
      if (cost > 0) {
          const isExempt = user.role === 'ADMIN' || 
                          (user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date());
          
          if (!isExempt) {
              if (user.credits < cost) {
                  setAlertConfig({isOpen: true, message: `Insufficient Credits! Viewing ${item.title} costs ${cost} coins.`});
                  return;
              }
              setConfirmConfig({
                  isOpen: true,
                  message: `Re-opening ${item.title} will cost ${cost} Credits. Proceed?`,
                  onConfirm: () => executeOpenItem(item, cost)
              });
              return;
          }
      }
      executeOpenItem(item, 0);
  };

  const filteredHistory = history.filter(h => 
    h.title.toLowerCase().includes(search.toLowerCase()) || 
    h.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const h = Math.floor(m / 60);
      if (h > 0) return `${h}h ${m % 60}m`;
      return `${m}m ${s}s`;
  };

  const renderStudyLog = () => {
      const studyLogs = usageLog.filter(l => ['VIDEO', 'PDF', 'MCQ', 'AUDIO', 'GAME'].includes(l.type));

      if (studyLogs.length === 0) return <p className="text-center py-12 text-slate-400">No study activity recorded yet.</p>;

      return Object.entries(studyLogs.reduce((acc: any, log) => {
          const d = new Date(log.timestamp);
          const year = d.getFullYear();
          const month = d.toLocaleString('default', { month: 'long' });
          if (!acc[year]) acc[year] = {};
          if (!acc[year][month]) acc[year][month] = [];
          acc[year][month].push(log);
          return acc;
      }, {})).sort((a,b) => Number(b[0]) - Number(a[0])).map(([year, months]: any) => (
          <div key={year} className="mb-4">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-2 ml-1">{year}</h4>
              {Object.entries(months).map(([month, logs]: any) => (
                  <div key={month} className="mb-3">
                      <h5 className="font-bold text-slate-600 text-sm mb-2 sticky top-0 bg-slate-50 p-2 rounded-lg">{month}</h5>
                      <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                          {logs.map((log: any, i: number) => (
                               <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                                            log.type === 'VIDEO' ? 'bg-red-500' :
                                            log.type === 'PDF' ? 'bg-blue-500' :
                                            log.type === 'AUDIO' ? 'bg-green-500' :
                                            log.type === 'GAME' ? 'bg-orange-500' : 'bg-purple-500'
                                        }`}>
                                            {log.type === 'VIDEO' ? '▶' : log.type === 'PDF' ? '📄' : log.type === 'AUDIO' ? '🎵' : log.type === 'GAME' ? '🎰' : '📝'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm line-clamp-1">{log.itemTitle}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                                        </div>
                                   </div>
                                   {log.type !== 'MCQ' && <span className="text-xs font-bold text-slate-600">{formatDuration(log.durationSeconds || 0)}</span>}
                                   {log.type === 'MCQ' && log.score !== undefined && <span className="text-xs font-bold text-indigo-600">{Math.round((log.score/log.totalQuestions)*100)}%</span>}
                               </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      ));
  };

  const renderTransactions = () => {
      // Merge Subscription History & Credit Logs
      const subLogs = (user.subscriptionHistory || []).map(s => ({
          id: s.id,
          type: 'SUBSCRIPTION',
          title: `${s.tier} ${s.level} Plan`,
          amount: s.price,
          date: s.startDate,
          details: `Granted by ${s.grantSource}`
      }));

      const creditLogs = usageLog.filter(l => ['PURCHASE', 'CREDIT_SPEND', 'CREDIT_ADD'].includes(l.type)).map(l => ({
          id: l.id,
          type: l.type,
          title: l.itemTitle || (l.type === 'CREDIT_SPEND' ? 'Spent on Content' : 'Credits Added'),
          amount: l.amount || 0,
          date: l.timestamp,
          details: l.subject
      }));

      const allTrans = [...subLogs, ...creditLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (allTrans.length === 0) return <p className="text-center py-12 text-slate-400">No transaction history.</p>;

      return (
          <div className="space-y-3">
              {allTrans.map((t, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                              t.type === 'SUBSCRIPTION' ? 'bg-purple-600' :
                              t.type === 'CREDIT_ADD' || t.type === 'PURCHASE' ? 'bg-green-600' : 'bg-red-500'
                          }`}>
                              {t.type === 'SUBSCRIPTION' ? <Crown size={14} /> : <DollarSign size={14} />}
                          </div>
                          <div>
                              <p className="font-bold text-slate-800 text-sm">{t.title}</p>
                              <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleString()} • {t.details}</p>
                          </div>
                      </div>
                      <div className={`text-sm font-bold ${
                          t.type === 'CREDIT_SPEND' ? 'text-red-600' : 'text-green-600'
                      }`}>
                          {t.type === 'CREDIT_SPEND' ? '-' : '+'}{t.amount} {t.type === 'SUBSCRIPTION' ? 'INR' : 'CR'}
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  const renderLogins = () => {
      const logins = usageLog.filter(l => l.type === 'LOGIN');
      const combined = [
          ...logins.map(l => ({ type: 'LOGIN', date: l.timestamp, val: 0 })),
          ...onlineHistory.map(h => ({ type: 'ONLINE', date: h.date, val: h.seconds }))
      ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (combined.length === 0) return <p className="text-center py-12 text-slate-400">No login activity recorded.</p>;

      return (
          <div className="space-y-3">
              {combined.map((item, i) => {
                  const isLogin = item.type === 'LOGIN';
                  // For Online Date, we might have just Date string "Fri Oct 20 2023", need to handle it.
                  // Login has full ISO string.
                  const displayDate = isLogin ? new Date(item.date).toLocaleString() : item.date;

                  return (
                      <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${isLogin ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                          <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isLogin ? 'bg-slate-600' : 'bg-blue-500'}`}>
                                  {isLogin ? <LogIn size={14} /> : <Clock size={14} />}
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{isLogin ? 'Login Detected' : 'Daily Online Duration'}</p>
                                  <p className="text-[10px] text-slate-500">{displayDate}</p>
                              </div>
                          </div>
                          {!isLogin && (
                              <span className="text-xs font-black text-blue-600">{formatDuration(item.val)}</span>
                          )}
                      </div>
                  );
              })}
          </div>
      );
  };

  if (selectedLesson) {
      return (
          <div className="animate-in slide-in-from-right duration-300">
              <button onClick={() => setSelectedLesson(null)} className="mb-4 text-blue-600 font-bold hover:underline flex items-center gap-1">&larr; Back to History</button>
              <LessonView 
                 content={selectedLesson}
                 subject={{id: 'hist', name: selectedLesson.subjectName, icon: 'book', color: 'bg-slate-100'} as any} 
                 classLevel={'10' as any}
                 chapter={{id: 'hist', title: selectedLesson.title} as any}
                 loading={false}
                 onBack={() => setSelectedLesson(null)}
                 user={user}
                 settings={settings}
              />
          </div>
      )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
        <CustomAlert isOpen={alertConfig.isOpen} message={alertConfig.message} onClose={() => setAlertConfig({...alertConfig, isOpen: false})} />
        <CustomConfirm isOpen={confirmConfig.isOpen} title="Confirm Action" message={confirmConfig.message} onConfirm={() => {confirmConfig.onConfirm(); setConfirmConfig({...confirmConfig, isOpen: false});}} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} />
        
        <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                 <History className="text-blue-600" /> History & Logs
            </h3>
        </div>

        {/* SCROLLABLE TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide px-1">
            <button onClick={() => setActiveTab('STUDY')} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border ${activeTab === 'STUDY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>Study Log</button>
            <button onClick={() => setActiveTab('SAVED')} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border ${activeTab === 'SAVED' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>Saved Notes</button>
            <button onClick={() => setActiveTab('TRANSACTIONS')} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border ${activeTab === 'TRANSACTIONS' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>Transactions</button>
            <button onClick={() => setActiveTab('LOGINS')} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border ${activeTab === 'LOGINS' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>Login & Usage</button>
        </div>

        <div className="px-1">
            {activeTab === 'STUDY' && renderStudyLog()}
            {activeTab === 'TRANSACTIONS' && renderTransactions()}
            {activeTab === 'LOGINS' && renderLogins()}
            {activeTab === 'SAVED' && (
                <>
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input type="text" placeholder="Search your notes..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    {filteredHistory.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200"><BookOpen size={48} className="mx-auto mb-3 opacity-30" /><p>No saved notes yet.</p></div>
                    ) : (
                        <div className="space-y-4">
                            {filteredHistory.map((item) => (
                                <div key={item.id} onClick={() => handleOpenItem(item)} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group relative">
                                    <div className="p-4">
                                        <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{item.title}</h4>
                                        <p className="text-xs text-slate-500 mt-1">{item.subjectName} • {new Date(item.dateCreated).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};
