
import React, { useState, useEffect } from 'react';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest, Chapter, MCQItem, Challenge20 } from '../types';
import { updateUserStatus, db, saveUserToLive, getChapterData, rtdb, saveAiInteraction } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, query, limitToLast, onValue } from 'firebase/database';
import { getSubjectsList, DEFAULT_APP_FEATURES, ALL_APP_FEATURES } from '../constants';
import { getActiveChallenges } from '../services/questionBank';
import { generateDailyChallengeQuestions } from '../utils/challengeGenerator';
import { generateMorningInsight } from '../services/morningInsight';
import { RedeemSection } from './RedeemSection';
import { PrizeList } from './PrizeList';
import { Store } from './Store';
import { Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, MessageSquare, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight, Video, Youtube, Home, User as UserIcon, Book, BookOpenText, List, BarChart3, Award, Bell, Headphones, LifeBuoy, WifiOff, Zap, Star, Crown, History, ListChecks, Rocket, Ticket, TrendingUp, BrainCircuit, FileText, CheckSquare, Menu, LayoutGrid, Compass, User as UserIconOutline, Bot } from 'lucide-react';
import { SubjectSelection } from './SubjectSelection';
import { BannerCarousel } from './BannerCarousel';
import { ChapterSelection } from './ChapterSelection';
import { VideoPlaylistView } from './VideoPlaylistView';
import { AudioPlaylistView } from './AudioPlaylistView';
import { PdfView } from './PdfView';
import { McqView } from './McqView';
import { MiniPlayer } from './MiniPlayer';
import { HistoryPage } from './HistoryPage';
import { Leaderboard } from './Leaderboard';
import { SpinWheel } from './SpinWheel';
import { fetchChapters, generateCustomNotes } from '../services/groq';
import { LoadingOverlay } from './LoadingOverlay';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { UserGuide } from './UserGuide';
import { CustomAlert } from './CustomDialogs';
import { AnalyticsPage } from './AnalyticsPage';
import { LiveResultsFeed } from './LiveResultsFeed';
import { UniversalInfoPage } from './UniversalInfoPage';
import { UniversalChat } from './UniversalChat';
import { AiHistoryPage } from './AiHistoryPage';
import { ExpiryPopup } from './ExpiryPopup';
import { SubscriptionHistory } from './SubscriptionHistory';
import { MonthlyMarksheet } from './MonthlyMarksheet';
import { SearchResult } from '../utils/syllabusSearch';
import { AiDeepAnalysis } from './AiDeepAnalysis';
import { CustomBloggerPage } from './CustomBloggerPage';
import { ReferralPopup } from './ReferralPopup';
import { StudentAiAssistant } from './StudentAiAssistant';
import { SpeakButton } from './SpeakButton';
import { PerformanceGraph } from './PerformanceGraph';
import { StudentSidebar } from './StudentSidebar';
import { StudyGoalTimer } from './StudyGoalTimer';
import { ExplorePage } from './ExplorePage';

interface Props {
  user: User;
  dailyStudySeconds: number;
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings;
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void;
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void;
  isImpersonating?: boolean;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (v: boolean) => void;
}

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate, isImpersonating, onNavigateToChapter, isDarkMode, onToggleDarkMode }) => {
  
  const hasPermission = (featureId: string) => {
      if (user.role === 'ADMIN') return true;
      if (!settings?.tierPermissions) return true;
      let tier: 'FREE' | 'BASIC' | 'ULTRA' = 'FREE';
      if (user.isPremium) {
          if (user.subscriptionLevel === 'ULTRA') tier = 'ULTRA';
          else tier = 'BASIC';
      }
      const allowed = settings.tierPermissions[tier] || [];
      return allowed.includes(featureId);
  };

  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', title?: string, message: string}>({isOpen: false, type: 'INFO', message: ''});
  const showAlert = (msg: string, type: 'SUCCESS'|'ERROR'|'INFO' = 'INFO', title?: string) => {
      setAlertConfig({ isOpen: true, type, title, message: msg });
  };

  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  useEffect(() => {
      const q = query(ref(rtdb, 'universal_updates'), limitToLast(1));
      const unsub = onValue(q, snap => {
          const data = snap.val();
          if (data) {
              const latest = Object.values(data)[0] as any;
              const lastRead = localStorage.getItem('nst_last_read_update') || '0';
              if (new Date(latest.timestamp).getTime() > Number(lastRead)) {
                  setHasNewUpdate(true);
                  const alertKey = `nst_update_alert_shown_${latest.id}`;
                  if (!localStorage.getItem(alertKey)) {
                      showAlert(`New Content Available: ${latest.text}`, 'INFO', 'New Update');
                      localStorage.setItem(alertKey, 'true');
                  }
              } else {
                  setHasNewUpdate(false);
              }
          }
      });
      return () => unsub();
  }, []);

  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const [activeExternalApp, setActiveExternalApp] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<{app: any, cost: number} | null>(null);
  const [contentViewStep, setContentViewStep] = useState<'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('SUBJECTS');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState<'SCHOOL' | 'COMPETITION'>('SCHOOL');
  const [currentAudioTrack, setCurrentAudioTrack] = useState<{url: string, title: string} | null>(null);
  const [universalNotes, setUniversalNotes] = useState<any[]>([]);

  useEffect(() => {
      getChapterData('nst_universal_notes').then(data => {
          if (data && data.notesPlaylist) setUniversalNotes(data.notesPlaylist);
      });
  }, []);
  
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      dailyGoalHours: 3
  });

  const [canClaimReward, setCanClaimReward] = useState(false);
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'HOME' || activeTab === 'EXPLORE' || activeTab === 'PROFILE') {
        setFullScreen(true);
    } else {
        if (activeTab !== 'VIDEO' && activeTab !== 'PDF' && activeTab !== 'MCQ' && activeTab !== 'AUDIO') {
             setFullScreen(false);
        }
    }
  }, [activeTab]);

  useEffect(() => {
      const isNew = (Date.now() - new Date(user.createdAt).getTime()) < 10 * 60 * 1000;
      if (isNew && !user.redeemedReferralCode && !localStorage.getItem(`referral_shown_${user.id}`)) {
          setShowReferralPopup(true);
          localStorage.setItem(`referral_shown_${user.id}`, 'true');
      }
  }, [user.id, user.createdAt, user.redeemedReferralCode]);

  const handleSupportEmail = () => {
    const email = "nadim841442@gmail.com";
    const subject = encodeURIComponent(`Support Request: ${user.name} (ID: ${user.id})`);
    const body = encodeURIComponent(`Student Details:\nName: ${user.name}\nUID: ${user.id}\nEmail: ${user.email}\n\nIssue Description:\n`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ subject: '', topic: '', type: 'PDF' });
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  
  useEffect(() => {
      if (user && user.id) {
          saveUserToLive(user);
      }
  }, [user.id]);

  const [discountTimer, setDiscountTimer] = useState<string | null>(null);
  const [discountStatus, setDiscountStatus] = useState<'WAITING' | 'ACTIVE' | 'NONE'>('NONE');
  const [showDiscountBanner, setShowDiscountBanner] = useState(false);

  useEffect(() => {
     const evt = settings?.specialDiscountEvent;
     
     const formatDiff = (diff: number) => {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        return `${d}d ${h}h ${m}m ${s}s`;
     };

     const checkStatus = () => {
         if (!evt?.enabled) {
             setShowDiscountBanner(false);
             setDiscountStatus('NONE');
             return;
         }
         const now = Date.now();
         const startsAt = evt.startsAt ? new Date(evt.startsAt).getTime() : now;
         const endsAt = evt.endsAt ? new Date(evt.endsAt).getTime() : now;
         
         if (now < startsAt) {
             setDiscountStatus('WAITING');
             setShowDiscountBanner(true);
             setDiscountTimer(formatDiff(startsAt - now));
         } else if (now < endsAt) {
             setDiscountStatus('ACTIVE');
             setShowDiscountBanner(true);
             setDiscountTimer(formatDiff(endsAt - now));
         } else {
             setDiscountStatus('NONE');
             setShowDiscountBanner(false);
         }
     };
     checkStatus();
     if (evt?.enabled) {
         const interval = setInterval(checkStatus, 1000);
         return () => clearInterval(interval);
     }
  }, [settings?.specialDiscountEvent]);

  const handleAiNotesGeneration = async () => {
      if (!aiTopic.trim()) { showAlert("Please enter a topic!", "ERROR"); return; }
      const today = new Date().toDateString();
      const usageKey = `nst_ai_usage_${user.id}_${today}`;
      const currentUsage = parseInt(localStorage.getItem(usageKey) || '0');
      let limit = settings?.aiLimits?.free || 0;
      if (user.subscriptionLevel === 'BASIC' && user.isPremium) limit = settings?.aiLimits?.basic || 0;
      if (user.subscriptionLevel === 'ULTRA' && user.isPremium) limit = settings?.aiLimits?.ultra || 0;

      if (currentUsage >= limit) {
          showAlert(`Daily Limit Reached! ${currentUsage}/${limit}`, "ERROR");
          return;
      }
      setAiGenerating(true);
      try {
          const notes = await generateCustomNotes(aiTopic, settings?.aiNotesPrompt || '', settings?.aiModel);
          setAiResult(notes);
          localStorage.setItem(usageKey, (currentUsage + 1).toString());
          saveAiInteraction({
              id: `ai-note-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              type: 'AI_NOTES',
              query: aiTopic,
              response: notes,
              timestamp: new Date().toISOString()
          });
          showAlert("Notes Generated!", "SUCCESS");
      } catch (e) {
          showAlert("Failed to generate notes.", "ERROR");
      } finally {
          setAiGenerating(false);
      }
  };

  const handleSwitchToAdmin = () => { if (onNavigate) onNavigate('ADMIN_DASHBOARD'); };

  useEffect(() => {
      const checkCompetitionAccess = () => {
          if (syllabusMode === 'COMPETITION') {
              const now = new Date();
              const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > now;
              const hasAccess = isSubscribed && (user.subscriptionLevel === 'ULTRA' || user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME');
              
              if (!hasAccess) {
                  setSyllabusMode('SCHOOL');
                  showAlert("⚠️ Competition Mode is locked! Upgrade to Ultra.", 'ERROR');
              }
          }
      };
      checkCompetitionAccess();
      const interval = setInterval(checkCompetitionAccess, 60000);
      return () => clearInterval(interval);
  }, [syllabusMode, user.isPremium, user.subscriptionEndDate]);

  useEffect(() => {
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  useEffect(() => {
    if (!user.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as User;
            if (cloudData.credits !== user.credits || 
                cloudData.subscriptionTier !== user.subscriptionTier ||
                cloudData.isPremium !== user.isPremium) {
                const updated = { ...user, ...cloudData };
                onRedeemSuccess(updated); 
            }
        }
    });
    return () => unsub();
  }, [user.id]); 

  useEffect(() => {
      const interval = setInterval(() => {
          updateUserStatus(user.id, dailyStudySeconds);
          const todayStr = new Date().toDateString();
          localStorage.setItem(`activity_${user.id}_${todayStr}`, dailyStudySeconds.toString());
      }, 60000); 
      return () => clearInterval(interval);
  }, [dailyStudySeconds, user.id]);

  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';
    setCanClaimReward(lastClaim !== today && dailyStudySeconds >= dailyTargetSeconds);
  }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;
      let finalReward = settings?.loginBonusConfig?.freeBonus ?? 3;
      if (user.subscriptionTier !== 'FREE') {
          if (user.subscriptionLevel === 'BASIC') finalReward = settings?.loginBonusConfig?.basicBonus ?? 5;
          if (user.subscriptionLevel === 'ULTRA') finalReward = settings?.loginBonusConfig?.ultraBonus ?? 10;
      }
      const updatedUser = {
          ...user,
          credits: (user.credits || 0) + finalReward,
          lastRewardClaimDate: new Date().toISOString()
      };
      handleUserUpdate(updatedUser);
      setCanClaimReward(false);
      showAlert(`Received: ${finalReward} Free Credits!`, 'SUCCESS');
  };

  const handleExternalAppClick = (app: any) => {
      if (app.isLocked) { showAlert("This app is currently locked.", 'ERROR'); return; }
      if (app.creditCost > 0) {
          if (user.credits < app.creditCost) { showAlert(`Insufficient Credits! Need ${app.creditCost}.`, 'ERROR'); return; }
          if (user.isAutoDeductEnabled) processAppAccess(app, app.creditCost);
          else setPendingApp({ app, cost: app.creditCost });
          return;
      }
      setActiveExternalApp(app.url);
  };

  const processAppAccess = (app: any, cost: number, enableAuto: boolean = false) => {
      let updatedUser = { ...user, credits: user.credits - cost };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      handleUserUpdate(updatedUser);
      setActiveExternalApp(app.url);
      setPendingApp(null);
  };

  const saveProfile = () => {
      const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      const cost = settings?.profileEditCost ?? 10;
      if (!isPremium && user.credits < cost) {
          showAlert(`Profile update costs ${cost} NST Coins.`, 'ERROR');
          return;
      }
      const updatedUser = { 
          ...user, 
          board: profileData.board,
          classLevel: profileData.classLevel,
          stream: profileData.stream,
          password: profileData.newPassword.trim() ? profileData.newPassword : user.password,
          credits: isPremium ? user.credits : user.credits - cost
      };
      localStorage.setItem(`nst_goal_${user.id}`, profileData.dailyGoalHours.toString());
      setDailyTargetSeconds(profileData.dailyGoalHours * 3600);
      handleUserUpdate(updatedUser);
      window.location.reload(); 
      setEditMode(false);
  };
  
  const handleUserUpdate = (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          if (!isImpersonating) {
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              saveUserToLive(updatedUser); 
          }
          onRedeemSuccess(updatedUser); 
      }
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  const handleContentSubjectSelect = async (subject: Subject) => {
      setSelectedSubject(subject);
      setLoadingChapters(true);
      setContentViewStep('CHAPTERS');
      try {
          const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
          setChapters(ch);
      } catch(e) { console.error(e); }
      setLoadingChapters(false);
  };

  const [showSyllabusPopup, setShowSyllabusPopup] = useState<{
    subject: Subject;
    chapter: Chapter;
  } | null>(null);

  const handleContentChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setContentViewStep('PLAYER');
    setFullScreen(true);
  };

  const renderContentSection = (type: 'VIDEO' | 'PDF' | 'MCQ' | 'AUDIO') => {
      const handlePlayerBack = () => {
          setContentViewStep('CHAPTERS');
          setFullScreen(false);
      };

      if (contentViewStep === 'PLAYER' && selectedChapter && selectedSubject) {
          if (type === 'VIDEO') return <VideoPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} initialSyllabusMode={syllabusMode} />;
          if (type === 'PDF') return <PdfView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} initialSyllabusMode={syllabusMode} directResource={(selectedChapter as any).directResource} />;
          if (type === 'AUDIO') return <AudioPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} onPlayAudio={setCurrentAudioTrack} initialSyllabusMode={syllabusMode} />;
          return <McqView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
      }

      if (contentViewStep === 'CHAPTERS' && selectedSubject) {
          return (
              <ChapterSelection 
                  chapters={chapters} 
                  subject={selectedSubject} 
                  classLevel={user.classLevel || '10'} 
                  loading={loadingChapters} 
                  user={user} 
                  settings={settings}
                  onSelect={(chapter, contentType) => {
                      setSelectedChapter(chapter);
                      if (contentType) {
                          setContentViewStep('PLAYER');
                          setFullScreen(true);
                      } else {
                          handleContentChapterSelect(chapter);
                      }
                  }} 
                  onBack={() => { setContentViewStep('SUBJECTS'); onTabChange('COURSES'); }} 
              />
          );
      }
      return null; 
  };

  const renderMainContent = () => {
      // 1. HOME TAB (Redesigned)
      if (activeTab === 'HOME') {
          return (
              <div className="space-y-6 pb-24">
                {/* NEW HEADER */}
                <div className="bg-white p-4 rounded-b-3xl shadow-sm border-b border-slate-200 sticky top-0 z-40">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">{settings?.appName || 'Student App'}</h2>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.displayId || user.id}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Credits</span>
                                <span className="font-black text-blue-600 flex items-center gap-1">
                                    <Crown size={14} className="fill-blue-600" /> {user.credits}
                                </span>
                            </div>
                            <div className="flex flex-col items-end border-l pl-4 border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Streak</span>
                                <span className="font-black text-orange-500 flex items-center gap-1">
                                    <Zap size={14} className="fill-orange-500" /> {user.streak}
                                </span>
                            </div>
                            {user.subscriptionEndDate && (
                                <div className="flex flex-col items-end border-l pl-4 border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Plan</span>
                                    <span className="font-black text-purple-600 flex items-center gap-1">
                                        <Clock size={14} />
                                        {(() => {
                                            if (user.subscriptionTier === 'LIFETIME') return '∞';
                                            const diff = new Date(user.subscriptionEndDate).getTime() - Date.now();
                                            if (diff <= 0) return 'Exp';
                                            return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 'd';
                                        })()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* PERFORMANCE GRAPH */}
                <div className="mx-2">
                    <PerformanceGraph
                        history={user.mcqHistory || []}
                        user={user}
                        onViewNotes={(topic) => { onTabChange('PDF'); }}
                    />
                </div>

                {/* STUDY TIMER & MENU BUTTON */}
                <div className="flex items-center gap-3 mx-2">
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 h-[120px] w-20 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                    >
                        <Menu size={28} className="text-slate-700" />
                        <span className="text-[10px] font-bold text-slate-500">MENU</span>
                    </button>
                    <div className="flex-1">
                        <StudyGoalTimer
                            dailyTargetSeconds={dailyTargetSeconds}
                            dailyStudySeconds={dailyStudySeconds}
                            onUpdateGoal={(h) => {
                                setDailyTargetSeconds(h * 3600);
                                localStorage.setItem(`nst_goal_${user.id}`, h.toString());
                            }}
                        />
                    </div>
                </div>

                {/* LARGE ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-4 mx-2">
                    <button
                        onClick={() => { onTabChange('COURSES'); setContentViewStep('SUBJECTS'); }}
                        className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-3 text-white h-32 active:scale-95 transition-transform"
                    >
                        <BookOpen size={32} />
                        <span className="font-black text-lg uppercase tracking-wide">My Courses</span>
                    </button>
                    <button
                        onClick={() => { onTabChange('ANALYTICS'); }}
                        className="bg-gradient-to-br from-purple-600 to-fuchsia-700 p-6 rounded-3xl shadow-lg shadow-purple-200 flex flex-col items-center justify-center gap-3 text-white h-32 active:scale-95 transition-transform"
                    >
                        <BarChart3 size={32} />
                        <span className="font-black text-lg uppercase tracking-wide">My Analysis</span>
                    </button>
                </div>
              </div>
          );
      }

      // 2. AI STUDIO (Formerly Explore)
      if (activeTab === 'EXPLORE') {
          return (
              <div className="space-y-6 pb-24 p-4">
                  <div className="flex items-center justify-between mb-2">
                      <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                          <Bot className="text-indigo-600" /> AI Studio
                      </h2>
                  </div>

                  {/* DISCOUNT BANNER */}
                  {showDiscountBanner && discountTimer && (
                      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden mb-6">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                          <div className="relative z-10 flex justify-between items-center">
                              <div>
                                  <h3 className="font-black text-lg flex items-center gap-2">
                                      <Sparkles className="text-yellow-400" /> SALE IS LIVE
                                  </h3>
                                  <p className="text-xs text-blue-200 font-bold">{settings?.specialDiscountEvent?.discountPercent || 50}% OFF Ends in:</p>
                              </div>
                              <div className="text-2xl font-mono font-black">{discountTimer}</div>
                          </div>
                      </div>
                  )}

                  {/* AUTO SLIDING BANNERS */}
                  {settings?.exploreBanners && settings.exploreBanners.filter(b => b.isActive).length > 0 && (
                      <div className="rounded-2xl overflow-hidden shadow-lg mb-6">
                          <BannerCarousel
                              slides={settings.exploreBanners.filter(b => b.isActive).map(b => ({
                                  id: b.id,
                                  image: b.imageUrl,
                                  title: '',
                                  subtitle: '',
                                  link: b.actionUrl || ''
                              }))}
                              interval={3000}
                              autoPlay={true}
                              showDots={true}
                              showArrows={false}
                          >
                              {/* Children are passed as slides logic handled in BannerCarousel */}
                          </BannerCarousel>
                      </div>
                  )}

                  {/* AI TOOLS */}
                  <div className="grid grid-cols-2 gap-4">
                      <button
                          onClick={() => onTabChange('AI_CHAT')}
                          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center gap-3 hover:border-indigo-200 transition-colors group"
                      >
                          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                              <MessageCircle size={28} />
                          </div>
                          <div className="text-center">
                              <h3 className="font-black text-slate-800">AI Tutor</h3>
                              <p className="text-[10px] text-slate-400">Chat & Learn</p>
                          </div>
                      </button>

                      <button
                          onClick={() => setShowAiModal(true)}
                          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center gap-3 hover:border-sky-200 transition-colors group"
                      >
                          <div className="w-14 h-14 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                              <BrainCircuit size={28} />
                          </div>
                          <div className="text-center">
                              <h3 className="font-black text-slate-800">AI Agent</h3>
                              <p className="text-[10px] text-slate-400">Gen Notes</p>
                          </div>
                      </button>
                  </div>
              </div>
          );
      }

      if (activeTab === 'COURSES') {
          const visibleSubjects = getSubjectsList(user.classLevel || '10', user.stream || null).filter(s => !(settings?.hiddenSubjects || []).includes(s.id));
          return (
              <div className="space-y-6 pb-24 p-4">
                  <h2 className="text-2xl font-black text-slate-800">All Courses</h2>
                  <div className="grid grid-cols-2 gap-3">
                      {visibleSubjects.map(s => (
                          <button key={s.id} onClick={() => { onTabChange('VIDEO'); handleContentSubjectSelect(s); }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:shadow-md transition-all">
                              <div className={`w-12 h-12 rounded-full ${s.color?.split(' ')[0] || 'bg-blue-500'} flex items-center justify-center text-white font-bold text-lg`}>
                                  {s.name.charAt(0)}
                              </div>
                              <span className="font-bold text-xs text-slate-700 text-center">{s.name}</span>
                          </button>
                      ))}
                  </div>
              </div>
          );
      }

      if (activeTab === 'CUSTOM_PAGE') return <CustomBloggerPage onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'DEEP_ANALYSIS') return <AiDeepAnalysis user={user} settings={settings} onUpdateUser={handleUserUpdate} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'AI_HISTORY') return <AiHistoryPage user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'UPDATES') return <UniversalInfoPage onBack={() => onTabChange('HOME')} />;
      if ((activeTab as string) === 'ANALYTICS') return <AnalyticsPage user={user} onBack={() => onTabChange('HOME')} settings={settings} onNavigateToChapter={onNavigateToChapter} />;
      if ((activeTab as string) === 'SUB_HISTORY') return <SubscriptionHistory user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard user={user} settings={settings} />;
      if (activeTab === 'GAME') return <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'REDEEM') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>;
      if (activeTab === 'PRIZES') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><PrizeList /></div>;
      if (activeTab === 'STORE') return <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />;
      if (activeTab === 'MARKSHEET') return <MonthlyMarksheet user={user} settings={settings} onClose={() => onTabChange('HOME')} />;

      if (activeTab === 'INBOX') {
          return (
              <div className="min-h-screen bg-white animate-in fade-in slide-in-from-right">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-blue-600" /> Inbox</h3>
                      <button onClick={() => onTabChange('HOME')} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="p-4 space-y-3 pb-24">
                      {(!user.inbox || user.inbox.length === 0) && <p className="text-slate-400 text-sm text-center py-20">No messages found.</p>}
                      {user.inbox?.map(msg => (
                          <div key={msg.id} className={`p-4 rounded-xl border text-sm ${msg.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'} transition-all`}>
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-600">{msg.type === 'GIFT' ? '🎁 GIFT' : 'MESSAGE'}</p>
                                      {!msg.read && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>}
                                  </div>
                                  <p className="text-slate-400 text-[10px]">{new Date(msg.date).toLocaleDateString()}</p>
                              </div>
                              <p className="text-slate-800 leading-relaxed mb-3 font-medium">{msg.text}</p>

                              {(msg.type === 'REWARD' || msg.type === 'GIFT') && !msg.isClaimed && (
                                  <button
                                      onClick={() => claimRewardMessage(msg.id, msg.reward, msg.gift)}
                                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] transition-transform text-xs flex items-center justify-center gap-2"
                                  >
                                      <Gift size={16} /> Claim {msg.type === 'GIFT' ? 'Gift' : 'Reward'}
                                  </button>
                              )}
                              {(msg.isClaimed) && <p className="text-[10px] text-green-600 font-bold bg-green-50 inline-block px-3 py-1.5 rounded-lg border border-green-100">✅ Claimed</p>}
                          </div>
                      ))}
                      {unreadCount > 0 && <button onClick={markInboxRead} className="fixed bottom-24 left-4 right-4 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 z-20">Mark All as Read</button>}
                  </div>
              </div>
          );
      }
      if (activeTab === 'PROFILE') return (
                <div className="animate-in fade-in zoom-in duration-300 pb-24 p-4">
                    {/* Simplified Profile for Clean Look */}
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100 text-center mb-6 relative overflow-hidden">
                        <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-black text-slate-400">
                            {user.name.charAt(0)}
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">{user.name}</h2>
                        <p className="text-slate-500 text-xs font-mono">{user.displayId || user.id}</p>
                        <div className="mt-4 flex justify-center gap-2">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">{user.classLevel}</span>
                            <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold">{user.board}</span>
                        </div>
                    </div>
                    <button onClick={() => setEditMode(true)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold mb-4">Edit Profile</button>
                    <button onClick={() => {localStorage.removeItem(`nst_user_${user.id}`); window.location.reload();}} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold">Logout</button>
                </div>
      );

      if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'AUDIO') {
          return renderContentSection(activeTab);
      }

      return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
        {/* Layout Editor & Admin Switch */}
        {(user.role === 'ADMIN' || isImpersonating) && (
             <div className="fixed bottom-36 right-4 z-50 flex flex-col gap-3 items-end">
                 <button onClick={handleSwitchToAdmin} className="bg-slate-900 text-white p-4 rounded-full shadow-2xl border-2 border-slate-700 hover:scale-110 transition-transform flex items-center gap-2">
                     <Layout size={20} className="text-yellow-400" />
                 </button>
             </div>
        )}

        {showAiModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-slate-800">AI Note Generator</h3>
                        <button onClick={() => {setShowAiModal(false); setAiResult(null);}}><X size={20} /></button>
                    </div>
                    {!aiResult ? (
                        <div className="space-y-4">
                            <textarea value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Enter topic..." className="w-full p-4 bg-slate-50 border-none rounded-2xl h-32 resize-none" />
                            <button onClick={handleAiNotesGeneration} disabled={aiGenerating} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl">
                                {aiGenerating ? "Generating..." : "Generate Notes"}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-xl mb-4 whitespace-pre-wrap">{aiResult}</div>
                            <button onClick={() => { navigator.clipboard.writeText(aiResult); showAlert("Copied!", "SUCCESS"); }} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Copy</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MAIN RENDER */}
        {renderMainContent()}

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => { onTabChange('HOME'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'HOME' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={activeTab === 'HOME' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>
                <button onClick={() => onTabChange('EXPLORE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'EXPLORE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Bot size={24} fill={activeTab === 'EXPLORE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">AI Studio</span>
                </button>
                <button onClick={() => onTabChange('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'HISTORY' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <History size={24} className={activeTab === 'HISTORY' ? "text-blue-600" : ""} />
                    <span className="text-[10px] font-bold mt-1">History</span>
                </button>
                <button onClick={() => onTabChange('PROFILE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <UserIconOutline size={24} fill={activeTab === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>
            </div>
        </div>

        {/* SIDEBAR */}
        <StudentSidebar
            isOpen={showSidebar}
            onClose={() => setShowSidebar(false)}
            onNavigate={(tab) => {
                onTabChange(tab);
                setShowSidebar(false);
            }}
            user={user}
            settings={settings}
            onLogout={() => {
                localStorage.removeItem('nst_current_user');
                window.location.reload();
            }}
        />

        {showRequestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <h3 className="text-lg font-black text-slate-800 mb-4">Request Content</h3>
                    <div className="space-y-3 mb-6">
                        <input type="text" value={requestData.subject} onChange={e => setRequestData({...requestData, subject: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Subject" />
                        <input type="text" value={requestData.topic} onChange={e => setRequestData({...requestData, topic: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Topic" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowRequestModal(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Cancel</button>
                        <button onClick={() => { showAlert("Request Sent!", "SUCCESS"); setShowRequestModal(false); }} className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl">Send</button>
                    </div>
                </div>
            </div>
        )}

        <StudentAiAssistant user={user} settings={settings} isOpen={activeTab === 'AI_CHAT'} onClose={() => onTabChange('HOME')} />
        <CustomAlert isOpen={alertConfig.isOpen} type={alertConfig.type} title={alertConfig.title} message={alertConfig.message} onClose={() => setAlertConfig(prev => ({...prev, isOpen: false}))} />
        {isLoadingContent && <LoadingOverlay dataReady={isDataReady} onComplete={() => { setIsLoadingContent(false); setContentViewStep('PLAYER'); setFullScreen(true); }} />}
    </div>
  );
};
