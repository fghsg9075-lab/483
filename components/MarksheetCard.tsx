import React, { useState, useEffect } from 'react';
import { MCQResult, User, SystemSettings } from '../types';
import { X, Share2, ChevronLeft, ChevronRight, Download, FileSearch, Grid, CheckCircle, XCircle, Clock, Award, BrainCircuit, Play, StopCircle, BookOpen, Target, Zap, BarChart3, ListChecks, FileText, LayoutTemplate, TrendingUp, Lightbulb, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateUltraAnalysis } from '../services/groq';
import { saveUniversalAnalysis, saveUserToLive, saveAiInteraction, getChapterData } from '../firebase';
import ReactMarkdown from 'react-markdown';
import { speakText, stopSpeech, getCategorizedVoices } from '../utils/textToSpeech';
import { CustomConfirm } from './CustomDialogs'; // Import CustomConfirm

interface Props {
  result: MCQResult;
  user: User;
  settings?: SystemSettings;
  onClose: () => void;
  onViewAnalysis?: (cost: number) => void;
  onPublish?: () => void;
  questions?: any[]; 
  onUpdateUser?: (user: User) => void;
  initialView?: 'ANALYSIS' | 'RECOMMEND';
  onLaunchContent?: (content: any) => void;
}

export const MarksheetCard: React.FC<Props> = ({ result, user, settings, onClose, onViewAnalysis, onPublish, questions, onUpdateUser, initialView, onLaunchContent }) => {
  const [page, setPage] = useState(1);
  // Replaced showOMR with activeTab logic
  const [activeTab, setActiveTab] = useState<'OMR' | 'MISTAKES' | 'AI' | 'RECOMMEND' | 'MARKSHEET_1' | 'MARKSHEET_2'>('MARKSHEET_1');
  
  // ULTRA ANALYSIS STATE
  const [ultraAnalysisResult, setUltraAnalysisResult] = useState('');
  const [isLoadingUltra, setIsLoadingUltra] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null); // New state for HTML Note Modal
  const [showAnalysisSelection, setShowAnalysisSelection] = useState(false); // Modal for Free vs Premium

  const generateLocalAnalysis = () => {
      // Calculate weak/strong based on topicStats
      const topics = Object.keys(topicStats).map(t => {
          const s = topicStats[t];
          let status = 'AVERAGE';
          if (s.percent >= 80) status = 'STRONG';
          else if (s.percent < 50) status = 'WEAK';

          return {
              name: t,
              status,
              actionPlan: status === 'WEAK' ? 'Focus on basic concepts and practice more questions from this topic.' : 'Good job! Keep revising to maintain speed.',
              studyMode: status === 'WEAK' ? 'DEEP_STUDY' : 'QUICK_REVISION'
          };
      });

      const weakTopics = topics.filter(t => t.status === 'WEAK').map(t => t.name);

      return JSON.stringify({
          motivation: percentage > 80 ? "Excellent Performance! You are on track." : "Keep working hard. You can improve!",
          topics: topics,
          nextSteps: {
              focusTopics: weakTopics.slice(0, 3),
              action: weakTopics.length > 0 ? "Review the recommended notes for these topics immediately." : "Take a mock test to challenge yourself."
          },
          weakToStrongPath: weakTopics.map((t, i) => ({ step: i+1, action: `Read ${t} Notes` }))
      });
  };
  
  // TTS State
  const [voices, setVoices] = useState<{hindi: SpeechSynthesisVoice[], indianEnglish: SpeechSynthesisVoice[], others: SpeechSynthesisVoice[]}>({hindi: [], indianEnglish: [], others: []});
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  
  // Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // RECOMMENDATION STATE
  const [showRecModal, setShowRecModal] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [topicStats, setTopicStats] = useState<Record<string, {total: number, correct: number, percent: number}>>({});

  useEffect(() => {
      if (questions) {
          const stats: Record<string, {total: number, correct: number, percent: number}> = {};
          questions.forEach((q, idx) => {
              const topic = q.topic || 'General';
              if (!stats[topic]) stats[topic] = { total: 0, correct: 0, percent: 0 };
              stats[topic].total++;

              const omr = result.omrData?.find(d => d.qIndex === idx);
              if (omr && omr.selected === q.correctAnswer) {
                  stats[topic].correct++;
              }
          });

          Object.keys(stats).forEach(t => {
              stats[t].percent = Math.round((stats[t].correct / stats[t].total) * 100);
          });
          setTopicStats(stats);
      }
  }, [questions]);

  // Handle Initial View Logic
  useEffect(() => {
      if (initialView === 'RECOMMEND' && questions && questions.length > 0) {
          // Allow state to settle, then open
          setTimeout(() => {
              handleRecommend();
          }, 500);
      }
  }, [initialView, questions]);

  // Auto-Load Recommendations on Tab Change
  useEffect(() => {
      // Only fetch if data is missing. Do NOT open modal automatically.
      if ((activeTab === 'RECOMMEND' || activeTab === 'AI') && questions && questions.length > 0 && recommendations.length === 0) {
          handleRecommend(false); // Pass false to suppress modal
      }
  }, [activeTab, questions]);

  const handleRecommend = async (openModal: boolean = true) => {
      setRecLoading(true);
      if(openModal) setShowRecModal(true);

      // Identify weak topics (Percent < 60)
      const weakTopics = Object.keys(topicStats).filter(t => topicStats[t].percent < 60);

      // Default to all topics if no specific weak areas found (e.g. 100% score) or if data is sparse
      const searchTopics = (weakTopics.length > 0 ? weakTopics : Object.keys(topicStats)).map(t => t.trim().toLowerCase());

      const streamKey = (result.classLevel === '11' || result.classLevel === '12') && user.stream ? `-${user.stream}` : '';
      const key = `nst_content_${user.board || 'CBSE'}_${result.classLevel || '10'}${streamKey}_${result.subjectName}_${result.chapterId}`;

      // 1. Fetch Chapter Content (For Free/Premium Notes)
      let chapterData: any = {};
      try {
          chapterData = await getChapterData(key);
      } catch (e) { console.error(e); }

      // 2. Fetch Universal Notes (Recommended List)
      let universalData: any = {};
      try {
          universalData = await getChapterData('nst_universal_notes');
      } catch (e) { console.error(e); }

      const recs: any[] = [];

      // A) Free Recommendations (From Chapter HTML)
      const freeHtml = chapterData?.freeNotesHtml || chapterData?.schoolFreeNotesHtml;

      if (freeHtml) {
           // EXTRACT TOPIC NAMES FROM HTML HEADERS
           const extractedTopics: string[] = [];
           try {
               const doc = new DOMParser().parseFromString(freeHtml, 'text/html');
               const headers = doc.querySelectorAll('h1, h2, h3, h4');
               headers.forEach(h => {
                   if(h.textContent && h.textContent.length > 3) extractedTopics.push(h.textContent.trim());
               });
           } catch(e) {}

           // Filter extracted topics that match weak areas (Partial Match)
           const relevantExtracted = extractedTopics.filter(et =>
               searchTopics.some(st => et.toLowerCase().includes(st)) ||
               searchTopics.some(st => st.includes(et.toLowerCase()))
           );

           // If specific matches found, push them. Otherwise, push generic Chapter Notes.
           if (relevantExtracted.length > 0) {
               relevantExtracted.forEach(topicName => {
                   recs.push({
                       title: topicName,
                       topic: 'FREE NOTES TOPIC',
                       type: 'FREE_NOTES_LINK',
                       isPremium: false,
                       url: 'FREE_CHAPTER_NOTES',
                       access: 'FREE'
                   });
               });
           } else {
               // Fallback if no specific headers found or matched
               recs.push({
                   title: `Review Chapter: ${result.chapterTitle}`,
                   topic: 'FREE REVISION',
                   type: 'FREE_NOTES_LINK', // Special type to handle click
                   isPremium: false,
                   url: 'FREE_CHAPTER_NOTES', // Flag
                   access: 'FREE'
               });
           }
      }

      // B) Recommendations (Universal List)
      if (universalData && universalData.notesPlaylist) {
          const universalMatches = universalData.notesPlaylist.filter((n: any) =>
              searchTopics.some(t =>
                  n.title.toLowerCase().includes(t) ||
                  (n.topic && n.topic.toLowerCase().includes(t)) || // Partial Match
                  t.includes(n.topic?.toLowerCase() || '') // Reverse Partial Match
              )
          );
          recs.push(...universalMatches.map((n: any) => ({
              ...n,
              type: 'UNIVERSAL_NOTE',
              isPremium: n.access === 'PREMIUM' || n.type === 'PDF'
          })));
      }

      if (chapterData && chapterData.topicNotes) {
          // Robust Topic Matching (Case Insensitive, Trimmed, Partial)
          const topicMatches = chapterData.topicNotes.filter((n: any) =>
              searchTopics.some(wt =>
                  (n.topic && n.topic.toLowerCase().trim() === wt) ||
                  (n.topic && n.topic.toLowerCase().includes(wt)) ||
                  (n.topic && wt.includes(n.topic.toLowerCase()))
              )
          );
          recs.push(...topicMatches.map((n: any) => ({
              ...n,
              type: 'TOPIC_NOTE',
              access: n.isPremium ? 'PREMIUM' : 'FREE',
              isPremium: n.isPremium
          })));
      }

      setRecommendations(recs);
      setRecLoading(false);
  };

  const ITEMS_PER_PAGE = 50;

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  
  const omrData = result.omrData || [];
  const hasOMR = omrData.length > 0;
  const totalPages = Math.ceil(omrData.length / ITEMS_PER_PAGE);
  const currentData = omrData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const devName = settings?.footerText || 'Nadim Anwar'; // Configurable via Admin

  useEffect(() => {
    if (initialView === 'ANALYSIS' || result.ultraAnalysisReport) {
        // If initial view was analysis, we might want to default to AI tab or load it
        // But per request "1st omr sheet", we default to OMR.
        // We still load data if needed.
        if (result.ultraAnalysisReport) {
             setUltraAnalysisResult(result.ultraAnalysisReport);
        }
    }
  }, [initialView, result.ultraAnalysisReport]);

  useEffect(() => {
      getCategorizedVoices().then(v => {
          setVoices(v);
          // Prioritize Hindi or Indian English
          const preferred = v.hindi[0] || v.indianEnglish[0] || v.others[0];
          if (preferred) setSelectedVoice(preferred);
      });
  }, []);

  const handleDownload = async () => {
      // Logic for downloading current view
      let elementId = 'marksheet-content'; 
      if (activeTab === 'MARKSHEET_1') elementId = 'marksheet-style-1';
      if (activeTab === 'MARKSHEET_2') elementId = 'marksheet-style-2';
      
      const element = document.getElementById(elementId);
      if (!element) return;
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const link = document.createElement('a');
          link.download = `Marksheet_${user.name}_${new Date().getTime()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch (e) {
          console.error('Download failed', e);
      }
  };

  const handleDownloadAll = async () => {
      setIsDownloadingAll(true);
      // Allow time for render
      setTimeout(async () => {
          const element = document.getElementById('full-analysis-report');
          if (element) {
              try {
                  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                  const link = document.createElement('a');
                  link.download = `Full_Analysis_${user.name}_${new Date().getTime()}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
              } catch (e) {
                  console.error('Full Download Failed', e);
              }
          }
          setIsDownloadingAll(false);
      }, 1000);
  };

  const handleShare = async () => {
      const appLink = settings?.officialAppUrl || "https://play.google.com/store/apps/details?id=com.nsta.app"; 
      const text = `*${settings?.appName || 'IDEAL INSPIRATION CLASSES'} RESULT*\n\nName: ${user.name}\nScore: ${result.score}/${result.totalQuestions}\nAccuracy: ${percentage}%\nCorrect: ${result.correctCount}\nWrong: ${result.wrongCount}\nTime: ${formatTime(result.totalTimeSeconds)}\nDate: ${new Date(result.date).toLocaleDateString()}\n\nदेखिये मेरा NSTA रिजल्ट! आप भी टेस्ट दें...\nDownload App: ${appLink}`;
      if (navigator.share) {
          try { await navigator.share({ title: 'Result', text }); } catch(e) {}
      } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
  };

  const handleUltraAnalysis = async (skipCost: boolean = false) => {
      // 1. CHECK EXISTING REPORT (No Cost)
      if (result.ultraAnalysisReport) {
          setUltraAnalysisResult(result.ultraAnalysisReport);
          return;
      }

      if (!questions || questions.length === 0) {
          return;
      }

      const cost = settings?.mcqAnalysisCostUltra ?? 20;

      if (!skipCost) {
          if (user.credits < cost) {
              alert(`Insufficient Credits! You need ${cost} coins for Analysis Ultra.`);
              return;
          }

          if (!confirm(`Unlock AI Analysis Ultra for ${cost} Coins?\n\nThis will identify your weak topics and suggest a study plan.`)) {
              return;
          }
      }

      setIsLoadingUltra(true);
      
      try {
          // Prepare Data
          const userAnswers: Record<number, number> = {};
          if (result.omrData) {
              result.omrData.forEach(d => {
                  userAnswers[d.qIndex] = d.selected;
              });
          }

          // Generate Analysis LOCALLY (No API)
          await new Promise(resolve => setTimeout(resolve, 1500)); // Fake delay for effect
          const analysisText = generateLocalAnalysis();
          setUltraAnalysisResult(analysisText);

          // 2. DEDUCT CREDITS & SAVE REPORT (Only if not skipping cost or if it was free, but logic implies we save if generated)
          const updatedResult = { ...result, ultraAnalysisReport: analysisText };
          
          // Update History (Find and replace the result in history)
          const updatedHistory = (user.mcqHistory || []).map(r => r.id === result.id ? updatedResult : r);
          
          const updatedUser = { 
              ...user, 
              credits: skipCost ? user.credits : user.credits - cost,
              mcqHistory: updatedHistory
          };

          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          await saveUserToLive(updatedUser);
          if (onUpdateUser) onUpdateUser(updatedUser);

          // Log to Universal Analysis
          await saveUniversalAnalysis({
              id: `analysis-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              date: new Date().toISOString(),
              subject: result.subjectName,
              chapter: result.chapterTitle,
              score: result.score,
              totalQuestions: result.totalQuestions,
              userPrompt: `Analysis for ${result.totalQuestions} Questions. Score: ${result.score}`, 
              aiResponse: analysisText,
              cost: skipCost ? 0 : cost
          });
          
          // Also Log to AI History
          await saveAiInteraction({
              id: `ai-ultra-${Date.now()}`,
              userId: user.id,
              userName: user.name,
              type: 'ULTRA_ANALYSIS',
              query: `Ultra Analysis for ${result.chapterTitle}`,
              response: analysisText,
              timestamp: new Date().toISOString()
          });

      } catch (error: any) {
          console.error("Ultra Analysis Error:", error);
          setUltraAnalysisResult(JSON.stringify({ error: "Failed to generate analysis. Please try again or contact support." }));
      } finally {
          setIsLoadingUltra(false);
      }
  };

  const renderOMRRow = (qIndex: number, selected: number, correct: number) => {
      const options = [0, 1, 2, 3];
      return (
          <div key={qIndex} className="flex items-center gap-3 mb-2">
              <span className="w-6 text-[10px] font-bold text-slate-500 text-right">{qIndex + 1}</span>
              <div className="flex gap-1.5">
                  {options.map((opt) => {
                      let bgClass = "bg-white border border-slate-300 text-slate-400";
                      
                      const isSelected = selected === opt;
                      const isCorrect = correct === opt;
                      
                      if (isSelected) {
                          if (isCorrect) bgClass = "bg-green-600 border-green-600 text-white shadow-sm";
                          else bgClass = "bg-red-500 border-red-500 text-white shadow-sm";
                      } else if (isCorrect && selected !== -1) {
                          bgClass = "bg-green-600 border-green-600 text-white opacity-80"; 
                      } else if (isCorrect && selected === -1) {
                          bgClass = "border-green-500 text-green-600 bg-green-50";
                      }

                      return (
                          <div key={opt} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${bgClass}`}>
                              {String.fromCharCode(65 + opt)}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const toggleSpeech = (text: string) => {
      if (isSpeaking) {
          stopSpeech();
          setIsSpeaking(false);
      } else {
          // COIN CHECK
          const COST = 20;
          if (user.credits < COST) {
              alert(`Insufficient Coins! Voice costs ${COST} Coins.`);
              return;
          }
          if (!user.isAutoDeductEnabled) {
              setConfirmConfig({
                  isOpen: true,
                  title: "Listen to Analysis?",
                  message: `This will cost ${COST} Coins.`,
                  onConfirm: () => {
                      if(onUpdateUser) onUpdateUser({...user, credits: user.credits - COST});
                      setConfirmConfig(prev => ({...prev, isOpen: false}));
                      startSpeaking(text);
                  }
              });
              return;
          }
          
          if(onUpdateUser) onUpdateUser({...user, credits: user.credits - COST});
          startSpeaking(text);
      }
  };

  const startSpeaking = (text: string) => {
      speakText(text, selectedVoice, speechRate);
      setIsSpeaking(true);
  };

  // --- SECTION RENDERERS ---

  // NEW: Recommended Notes Section (Premium Style)
  const renderRecommendationsSection = () => {
      // Group recommendations by Topic
      const groupedRecs: Record<string, any[]> = {};
      recommendations.forEach(rec => {
          const topic = rec.topic || 'General';
          if(!groupedRecs[topic]) groupedRecs[topic] = [];
          groupedRecs[topic].push(rec);
      });

      // Filter for Weak/Average Topics based on topicStats
      const weakAvgTopics = Object.keys(topicStats).filter(t => topicStats[t].percent < 80);

      // If no specific weak topics, show all
      const displayTopics = weakAvgTopics.length > 0 ? weakAvgTopics : Object.keys(groupedRecs);

      return (
          <div className="bg-slate-50 min-h-full">
              {/* Branding Header */}
              <div className="bg-white p-6 rounded-b-3xl shadow-sm border-b border-slate-200 mb-6 text-center">
                  {settings?.appLogo && <img src={settings.appLogo} className="w-12 h-12 mx-auto mb-2 object-contain" />}
                  <h2 className="font-black text-slate-800 text-lg uppercase tracking-widest">{settings?.appName || 'INSTITUTE'}</h2>
                  <p className="text-xs font-bold text-slate-400">Personalized Study Plan for <span className="text-slate-900">{user.name}</span></p>
              </div>

              <div className="px-4 space-y-6 pb-20">
                  {displayTopics.map((topicName, idx) => {
                      // Find matching notes (partial match logic from handleRecommend needs to be consistent here,
                      // but since we group by 'topic' field in recs, we rely on that.
                      // However, handleRecommend puts correct 'topic' field in recs.
                      // Let's filter groupedRecs keys that match this topicName
                      const relevantRecs = groupedRecs[topicName] || [];

                      // Also check case-insensitive match if direct match fails
                      if (relevantRecs.length === 0) {
                          const key = Object.keys(groupedRecs).find(k => k.toLowerCase() === topicName.toLowerCase());
                          if (key) relevantRecs.push(...groupedRecs[key]);
                      }

                      if (relevantRecs.length === 0) return null;

                      const stats = topicStats[topicName];

                      return (
                          <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                  <div>
                                      <h3 className="font-black text-slate-800 text-sm uppercase">{topicName}</h3>
                                      {stats && (
                                          <div className="flex gap-2 mt-1">
                                              <span className="text-[10px] font-bold text-red-500">{stats.total - stats.correct} Wrong</span>
                                              <span className="text-[10px] font-bold text-green-600">{stats.correct} Correct</span>
                                          </div>
                                      )}
                                  </div>
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold">FOCUS</span>
                              </div>

                              <div className="p-2 space-y-2">
                                  {relevantRecs.map((rec, rIdx) => (
                                      <div key={rIdx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rec.isPremium ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                  {rec.isPremium ? <FileText size={14} /> : <Lightbulb size={14} />}
                                              </div>
                                              <div>
                                                  <p className="font-bold text-slate-700 text-xs line-clamp-1">{rec.title}</p>
                                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rec.isPremium ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                      {rec.isPremium ? 'PREMIUM PDF' : 'FREE NOTE'}
                                                  </span>
                                              </div>
                                          </div>

                                          <button
                                              onClick={() => {
                                                  if (rec.isPremium) {
                                                      // Premium Flow
                                                      if (onLaunchContent) {
                                                          onLaunchContent({
                                                              id: `REC_PREM_${idx}_${rIdx}`,
                                                              title: rec.title,
                                                              type: 'PDF',
                                                              directResource: { url: rec.url, access: rec.access }
                                                          });
                                                      } else {
                                                          window.open(rec.url, '_blank');
                                                      }
                                                  } else {
                                                      // Free Flow
                                                       if (rec.content) {
                                                          setViewingNote(rec);
                                                      } else if (onLaunchContent) {
                                                          onLaunchContent({
                                                              id: `REC_FREE_${idx}_${rIdx}`,
                                                              title: rec.title,
                                                              type: 'PDF',
                                                              directResource: { url: rec.url, access: rec.access }
                                                          });
                                                      }
                                                  }
                                              }}
                                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-sm ${rec.isPremium ? 'bg-slate-900 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'}`}
                                          >
                                              {rec.isPremium ? 'View PDF' : 'Read'}
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>

              {/* Developer Footer */}
              <div className="text-center py-6 text-slate-400 border-t border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest">Developed by {devName}</p>
              </div>
          </div>
      );
  };

  const renderOMRSection = () => (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Grid size={18} /> OMR Response Sheet
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                {currentData.map((data) => renderOMRRow(data.qIndex, data.selected, data.correct))}
            </div>
            {hasOMR && totalPages > 1 && !isDownloadingAll && (
                <div className="flex justify-center items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-slate-100 rounded-lg disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-slate-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
                </div>
            )}
        </div>
  );

  const renderMistakesSection = () => (
        <>
        <div className="flex items-center gap-2 mb-3 px-2">
            <XCircle className="text-red-500" size={20} />
            <h3 className="font-black text-slate-800 text-lg">Mistakes Review</h3>
        </div>
        {result.wrongQuestions && result.wrongQuestions.length > 0 ? (
            <div className="space-y-3">
                {result.wrongQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-red-100 shadow-sm flex gap-3">
                        <span className="w-6 h-6 flex-shrink-0 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                            {q.qIndex + 1}
                        </span>
                        <div className="flex-1">
                            <p className="text-sm text-slate-700 font-medium leading-relaxed mb-1">
                                {q.question}
                            </p>
                            <p className="text-xs text-green-600 font-bold">
                                Correct Answer: <span className="text-slate-700">{q.correctAnswer}</span>
                            </p>
                            {q.explanation && <p className="text-xs text-slate-500 mt-1 italic">{q.explanation}</p>}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                <p className="text-slate-500 font-bold">No mistakes found! Perfect Score! 🎉</p>
            </div>
        )}
        </>
  );

  const renderStatsSection = () => (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
            <div className="flex flex-col items-center text-center relative z-10">
                <h2 className="text-2xl font-black text-slate-800 capitalize mb-1">{user.name}</h2>
                <p className="text-xs font-bold text-slate-400 font-mono tracking-wider mb-6">UID: {user.displayId || user.id}</p>
                
                <div className="relative w-40 h-40 mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            fill="none"
                            stroke={percentage >= 80 ? "#22c55e" : percentage >= 50 ? "#3b82f6" : "#ef4444"}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${(percentage / 100) * 440} 440`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-slate-800">{result.score}</span>
                        <span className="text-sm font-bold text-slate-400">/{result.totalQuestions}</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full">
                    <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                        <p className="text-xl font-black text-green-700">{result.correctCount}</p>
                        <p className="text-[10px] font-bold text-green-600 uppercase">Correct</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
                        <p className="text-xl font-black text-red-700">{result.wrongCount}</p>
                        <p className="text-[10px] font-bold text-red-600 uppercase">Wrong</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <p className="text-xl font-black text-blue-700">{Math.round((result.totalTimeSeconds || 0) / 60)}m</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase">Time</p>
                    </div>
                </div>
            </div>
        </div>
  );

  // Render Analysis Content
  const renderAnalysisContent = () => {
    if (!ultraAnalysisResult) return null;

    let data: any = {};
    let isJson = false;
    try {
        data = JSON.parse(ultraAnalysisResult);
        isJson = true;
    } catch (e) {
        // Not JSON
    }

    if (!isJson) {
        return (
             <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-headings:font-black prose-headings:text-slate-800 prose-strong:text-indigo-700">
                <ReactMarkdown>{ultraAnalysisResult}</ReactMarkdown>
            </div>
        );
    }

    // Prepare Chart Data
    const topicStats = (data.topics || []).reduce((acc: any, t: any) => {
        if (t.status === 'STRONG') acc.strong++;
        else if (t.status === 'WEAK') acc.weak++;
        else acc.avg++;
        return acc;
    }, { strong: 0, weak: 0, avg: 0 });
    
    const totalTopics = (data.topics || []).length;

    // Professional Box Layout
    return (
        <div className="space-y-6">
            
            {/* PERFORMANCE OVERVIEW (From Stats) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                <div className="flex flex-col items-center text-center relative z-10">
                    <h2 className="text-2xl font-black text-slate-800 capitalize mb-1">{user.name}</h2>
                    <p className="text-xs font-bold text-slate-400 font-mono tracking-wider mb-6">UID: {user.displayId || user.id}</p>

                    <div className="relative w-40 h-40 mb-6">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                            <circle
                                cx="80"
                                cy="80"
                                r="70"
                                fill="none"
                                stroke={percentage >= 80 ? "#22c55e" : percentage >= 50 ? "#3b82f6" : "#ef4444"}
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeDasharray={`${(percentage / 100) * 440} 440`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-slate-800">{result.score}</span>
                            <span className="text-sm font-bold text-slate-400">/{result.totalQuestions}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 w-full">
                        <div className="bg-green-50 p-3 rounded-2xl border border-green-100">
                            <p className="text-xl font-black text-green-700">{result.correctCount}</p>
                            <p className="text-[10px] font-bold text-green-600 uppercase">Correct</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-2xl border border-red-100">
                            <p className="text-xl font-black text-red-700">{result.wrongCount}</p>
                            <p className="text-[10px] font-bold text-red-600 uppercase">Wrong</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                            <p className="text-xl font-black text-blue-700">{Math.round((result.totalTimeSeconds || 0) / 60)}m</p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Time</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOPIC BREAKDOWN (From Topics) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mb-6">
                    <BarChart3 size={18} /> Topic Breakdown
                </h3>
                <div className="space-y-4">
                    {Object.entries(topicStats).map(([topic, stat]) => (
                        <div key={topic} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-700 text-sm uppercase">{topic}</span>
                                <span className={`text-xs font-black ${stat.percent < 60 ? 'text-red-500' : 'text-green-600'}`}>
                                    {stat.percent}%
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                <div className="bg-white p-1 rounded border border-slate-200">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                                    <p className="text-xs font-black text-slate-800">{stat.total}</p>
                                </div>
                                <div className="bg-green-50 p-1 rounded border border-green-200">
                                    <p className="text-[9px] font-bold text-green-600 uppercase">Right</p>
                                    <p className="text-xs font-black text-green-700">{stat.correct}</p>
                                </div>
                                <div className="bg-red-50 p-1 rounded border border-red-200">
                                    <p className="text-[9px] font-bold text-red-600 uppercase">Wrong</p>
                                    <p className="text-xs font-black text-red-700">{stat.total - stat.correct}</p>
                                </div>
                            </div>

                            {/* NOTE BUTTONS FOR THIS TOPIC */}
                            {(() => {
                                // Match Logic (Same as handleRecommend)
                                const topicRecs = recommendations.filter(rec =>
                                    (rec.topic && rec.topic.toLowerCase().trim() === topic.toLowerCase().trim()) ||
                                    (rec.topic && topic.toLowerCase().includes(rec.topic.toLowerCase())) ||
                                    (rec.topic && rec.topic.toLowerCase().includes(topic.toLowerCase()))
                                );

                                if (topicRecs.length === 0) return null;

                                const hasFree = topicRecs.some(r => !r.isPremium);
                                const hasPremium = topicRecs.some(r => r.isPremium);

                                return (
                                    <div className="flex gap-2 border-t border-slate-100 pt-2">
                                        {hasFree && (
                                            <button
                                                onClick={() => {
                                                    const note = topicRecs.find(r => !r.isPremium);
                                                    if(note) {
                                                        if(note.content) setViewingNote(note);
                                                        else if(onLaunchContent) onLaunchContent({id: `REC_FREE_T_${topic}`, title: note.title, type: 'PDF', directResource: {url: note.url, access: 'FREE'}});
                                                    }
                                                }}
                                                className="flex-1 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-orange-200 transition-colors"
                                            >
                                                <Lightbulb size={10} /> Free Note
                                            </button>
                                        )}
                                        {hasPremium && (
                                            <button
                                                onClick={() => {
                                                    const note = topicRecs.find(r => r.isPremium);
                                                    if(note) {
                                                        if(onLaunchContent) onLaunchContent({id: `REC_PREM_T_${topic}`, title: note.title, type: 'PDF', directResource: {url: note.url, access: 'PREMIUM'}});
                                                        else window.open(note.url, '_blank');
                                                    }
                                                }}
                                                className="flex-1 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors"
                                            >
                                                <FileText size={10} /> Premium PDF
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            </div>

            {/* NEW: AI ROADMAP SECTION */}
            {data.nextSteps && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                    <h3 className="text-sm font-black text-indigo-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Target size={16} /> Next 2 Days Plan
                    </h3>
                    <div className="bg-white p-4 rounded-xl border border-indigo-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Focus Topics</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {data.nextSteps.focusTopics?.map((t: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
                                    {t}
                                </span>
                            ))}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Action</p>
                        <p className="text-sm text-slate-700 font-medium">{data.nextSteps.action}</p>
                    </div>
                </div>
            )}

            {/* NEW: WEAK TO STRONG PATH */}
            {data.weakToStrongPath && data.weakToStrongPath.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-green-600" /> Weak to Strong Path
                    </h3>
                    <div className="space-y-4">
                        {data.weakToStrongPath.map((step: any, i: number) => (
                            <div key={i} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md z-10">
                                        {step.step || i + 1}
                                    </div>
                                    {i < data.weakToStrongPath.length - 1 && <div className="w-0.5 h-full bg-slate-200 -my-2"></div>}
                                </div>
                                <div className="pb-4">
                                    <p className="text-sm font-bold text-slate-800">{step.action}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PERFORMANCE CHART (CSS) */}
            {totalTopics > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
                        <BarChart3 size={14} /> Topic Performance
                    </h4>
                    <div className="flex h-4 w-full rounded-full overflow-hidden">
                        <div style={{ width: `${(topicStats.strong / totalTopics) * 100}%` }} className="bg-green-500 h-full" title="Strong Topics" />
                        <div style={{ width: `${(topicStats.avg / totalTopics) * 100}%` }} className="bg-blue-400 h-full" title="Average Topics" />
                        <div style={{ width: `${(topicStats.weak / totalTopics) * 100}%` }} className="bg-red-500 h-full" title="Weak Topics" />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-500">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"/> Strong ({topicStats.strong})</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded-full"/> Average ({topicStats.avg})</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"/> Weak ({topicStats.weak})</div>
                    </div>
                </div>
            )}

            {/* NEW: VISUAL MIND MAP */}
            {data.topics && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-6 flex items-center gap-2">
                        <BrainCircuit size={16} className="text-purple-600" /> Topic Mind Map
                    </h3>
                    
                    <div className="min-w-[300px] flex flex-col items-center">
                        {/* Central Node */}
                        <div className="bg-slate-900 text-white px-6 py-3 rounded-full font-black text-sm shadow-lg mb-8 relative z-10 border-4 border-slate-100 text-center">
                            {data.chapter || result.chapterTitle || 'Chapter'}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                        </div>

                        {/* Branches */}
                        <div className="flex justify-center gap-4 flex-wrap relative">
                            {data.topics.map((topic: any, i: number) => {
                                let colorClass = "bg-blue-100 text-blue-800 border-blue-200";
                                if (topic.status === 'WEAK') colorClass = "bg-red-100 text-red-800 border-red-200";
                                if (topic.status === 'STRONG') colorClass = "bg-green-100 text-green-800 border-green-200";

                                return (
                                    <div key={i} className="flex flex-col items-center relative group">
                                        {/* Connector to parent */}
                                        <div className="w-0.5 h-8 bg-slate-300 -mt-8 mb-2"></div>
                                        
                                        <div className={`px-4 py-2 rounded-xl border-2 text-xs font-bold shadow-sm ${colorClass} max-w-[120px] text-center`}>
                                            {topic.name}
                                            <span className="block text-[8px] opacity-70 mt-1 uppercase">{topic.status}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {data.motivation && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-xl text-white shadow-lg text-center italic font-medium">
                    "{data.motivation}"
                </div>
            )}

            {data.topics && data.topics.map((topic: any, idx: number) => {
                let borderColor = "border-slate-200";
                let bgColor = "bg-white";
                let titleColor = "text-slate-800";
                
                if (topic.status === 'WEAK') {
                    borderColor = "border-red-500";
                    bgColor = "bg-red-50";
                    titleColor = "text-red-700";
                } else if (topic.status === 'STRONG') {
                    borderColor = "border-green-500";
                    bgColor = "bg-green-50";
                    titleColor = "text-green-700";
                } else {
                    borderColor = "border-blue-500";
                    bgColor = "bg-blue-50";
                    titleColor = "text-blue-700";
                }

                return (
                    <div key={idx} className={`rounded-xl border-2 ${borderColor} ${bgColor} overflow-hidden shadow-sm`}>
                        <div className={`p-4 border-b ${borderColor} flex justify-between items-center`}>
                            <h3 className={`font-black text-lg uppercase tracking-wide ${titleColor}`}>{topic.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${topic.status === 'WEAK' ? 'bg-red-500' : topic.status === 'STRONG' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                {topic.status}
                            </span>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Action Plan */}
                            <div className="bg-white p-3 rounded-xl border border-dashed border-slate-300">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                    <Target size={12} /> How to Work
                                </h4>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed">{topic.actionPlan}</p>
                            </div>

                            {/* Study Mode */}
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <BookOpen size={12} /> Recommendation:
                                </h4>
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${topic.studyMode === 'DEEP_STUDY' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                                    {topic.studyMode === 'DEEP_STUDY' ? 'DEEP STUDY REQUIRED' : 'QUICK REVISION'}
                                </span>
                            </div>

                            {/* TOPIC QUESTIONS LIST */}
                            {questions && questions.length > 0 && (() => {
                                const topicQs = questions.filter((q: any) =>
                                    (q.topic && q.topic.toLowerCase().trim() === topic.name.toLowerCase().trim()) ||
                                    (q.topic && topic.name.toLowerCase().includes(q.topic.toLowerCase())) ||
                                    (q.topic && q.topic.toLowerCase().includes(topic.name.toLowerCase()))
                                );

                                if (topicQs.length === 0) return null;

                                return (
                                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
                                            <ListChecks size={12} /> Questions in this Topic
                                        </h4>
                                        <div className="space-y-2">
                                            {topicQs.map((q: any, i: number) => {
                                                const qIndex = questions.indexOf(q);
                                                const omr = result.omrData?.find(d => d.qIndex === qIndex);
                                                const isCorrect = omr && omr.selected === q.correctAnswer;
                                                const isSkipped = !omr || omr.selected === -1;

                                                return (
                                                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-100' : isSkipped ? 'bg-slate-50 border-slate-100' : 'bg-red-50 border-red-100'}`}>
                                                        <div className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-green-500 text-white' : isSkipped ? 'bg-slate-300 text-white' : 'bg-red-500 text-white'}`}>
                                                            {qIndex + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[11px] font-medium text-slate-700 leading-snug line-clamp-2">{q.question}</p>
                                                        </div>
                                                        <div className="text-[10px] font-bold">
                                                            {isCorrect ? <span className="text-green-600">Correct</span> : isSkipped ? <span className="text-slate-400">Skipped</span> : <span className="text-red-500">Wrong</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                );
            })}


        </div>
    );
  };

  const getAnalysisTextForSpeech = () => {
    try {
        const data = JSON.parse(ultraAnalysisResult);
        let text = "";
        if (data.motivation) text += data.motivation + ". ";
        if (data.topics) {
            data.topics.forEach((t: any) => {
                text += `Topic: ${t.name}. Status: ${t.status}. ${t.actionPlan}. `;
            });
        }
        return text;
    } catch {
        return ultraAnalysisResult.replace(/[#*]/g, '');
    }
  };

  // MARKSHET STYLE 1: Centered Logo
  const renderMarksheetStyle1 = () => (
      <div id="marksheet-style-1" className="bg-white p-8 max-w-2xl mx-auto border-4 border-slate-900 rounded-none relative">
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-900"></div>
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-900"></div>
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-900"></div>
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-900"></div>
          
          {/* Header */}
          <div className="text-center mb-8">
              {settings?.appLogo && (
                  <img src={settings.appLogo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
              )}
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest">{settings?.appName || 'INSTITUTE NAME'}</h1>
              <p className="text-lg font-bold text-slate-500">{settings?.aiName || 'AI Assessment Center'}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Generated By {settings?.aiName || 'AI'}</p>
          </div>

          {/* User Info */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 flex justify-between items-center">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Candidate Name</p>
                  <p className="text-xl font-black text-slate-800">{user.name}</p>
              </div>
              <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">UID / Roll No</p>
                  <p className="text-xl font-black font-mono text-slate-800">{user.displayId || user.id}</p>
              </div>
          </div>

          {/* Score Grid */}
          <div className="mb-8">
              <h3 className="text-center font-bold text-slate-900 uppercase mb-4 border-b pb-2">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="border p-4 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase">Total Questions</p>
                      <p className="text-xl font-black">{result.totalQuestions}</p>
                  </div>
                  <div className="border p-4 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase">Attempted</p>
                      <p className="text-xl font-black">{result.correctCount + result.wrongCount}</p>
                  </div>
                  <div className="border p-4 bg-green-50 border-green-200">
                      <p className="text-xs font-bold text-green-600 uppercase">Correct</p>
                      <p className="text-xl font-black text-green-700">{result.correctCount}</p>
                  </div>
                  <div className="border p-4 bg-red-50 border-red-200">
                      <p className="text-xs font-bold text-red-600 uppercase">Wrong</p>
                      <p className="text-xl font-black text-red-700">{result.wrongCount}</p>
                  </div>
              </div>
              <div className="mt-4 bg-slate-900 text-white p-6 text-center rounded-xl">
                  <p className="text-sm font-bold opacity-60 uppercase mb-1">Total Score</p>
                  <p className="text-5xl font-black">{result.score} <span className="text-lg opacity-50">/ {result.totalQuestions}</span></p>
                  <p className="text-sm font-bold mt-2 text-yellow-400">{percentage}% Accuracy</p>
              </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-slate-200 pt-4 mt-8">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Developed by {devName}</p>
          </div>
      </div>
  );

  // MARKSHET STYLE 2: Side Logo
  const renderMarksheetStyle2 = () => (
      <div id="marksheet-style-2" className="bg-white p-8 max-w-2xl mx-auto border border-slate-300 relative">
          
          {/* Header */}
          <div className="flex items-center gap-6 mb-8 border-b-2 border-slate-900 pb-6">
              {settings?.appLogo ? (
                  <img src={settings.appLogo} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                  <div className="w-20 h-20 bg-slate-900 flex items-center justify-center text-white font-black text-2xl">A</div>
              )}
              <div>
                  <h1 className="text-4xl font-black text-slate-900 uppercase leading-none mb-1">{settings?.appName || 'INSTITUTE NAME'}</h1>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{settings?.aiName || 'AI Assessment Center'}</p>
              </div>
          </div>

          {/* User Info */}
          <div className="mb-8">
              <table className="w-full text-left">
                  <tbody>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase w-32">Candidate</td>
                          <td className="py-2 text-lg font-black text-slate-900 uppercase">{user.name}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">ID No.</td>
                          <td className="py-2 text-lg font-mono font-bold text-slate-700">{user.displayId || user.id}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">Test Date</td>
                          <td className="py-2 text-lg font-bold text-slate-700">{new Date(result.date).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                          <td className="py-2 text-sm font-bold text-slate-500 uppercase">Subject</td>
                          <td className="py-2 text-lg font-bold text-slate-700">{result.subjectName}</td>
                      </tr>
                  </tbody>
              </table>
          </div>

          {/* Score Big */}
          <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 bg-slate-100 p-6 rounded-lg text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Marks</p>
                  <p className="text-3xl font-black text-slate-900">{result.score}</p>
              </div>
              <div className="flex-1 bg-slate-900 text-white p-6 rounded-lg text-center">
                  <p className="text-xs font-bold opacity-60 uppercase">Percentage</p>
                  <p className="text-3xl font-black text-yellow-400">{percentage}%</p>
              </div>
          </div>

          {/* Detailed Grid */}
          <div className="grid grid-cols-4 gap-2 mb-12 text-center text-xs">
              <div className="bg-slate-50 p-2 border">
                  <span className="block font-bold text-slate-400 uppercase">Total Qs</span>
                  <span className="font-black text-lg">{result.totalQuestions}</span>
              </div>
              <div className="bg-slate-50 p-2 border">
                  <span className="block font-bold text-slate-400 uppercase">Attempted</span>
                  <span className="font-black text-lg">{result.correctCount + result.wrongCount}</span>
              </div>
              <div className="bg-green-50 p-2 border border-green-200">
                  <span className="block font-bold text-green-600 uppercase">Correct</span>
                  <span className="font-black text-lg text-green-700">{result.correctCount}</span>
              </div>
              <div className="bg-red-50 p-2 border border-red-200">
                  <span className="block font-bold text-red-600 uppercase">Wrong</span>
                  <span className="font-black text-lg text-red-700">{result.wrongCount}</span>
              </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end border-t-2 border-slate-900 pt-4">
               <div>
                   {settings?.appLogo && <img src={settings.appLogo} className="w-8 h-8 opacity-50 grayscale" />}
                   <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Generated By {settings?.aiName || 'AI'}</p>
               </div>
               <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Developed By</p>
                   <p className="text-xs font-black uppercase text-slate-900">{devName}</p>
               </div>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
        {/* FREE HTML NOTE MODAL */}
        {viewingNote && (
            <div className="fixed inset-0 z-[300] bg-white flex flex-col animate-in fade-in">
                <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        {settings?.appLogo && <img src={settings.appLogo} className="w-8 h-8 object-contain" />}
                        <div>
                            <h2 className="font-black text-slate-800 uppercase text-sm">{settings?.appName || 'Free Notes'}</h2>
                            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">Recommended Reading</p>
                        </div>
                    </div>
                    <button onClick={() => setViewingNote(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
                </header>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="max-w-3xl mx-auto bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[50vh]">
                        <h1 className="text-2xl font-black text-slate-900 mb-6 border-b pb-4">{viewingNote.title}</h1>
                        <div className="prose prose-slate max-w-none prose-headings:font-black" dangerouslySetInnerHTML={{ __html: (viewingNote.content) }} />
                    </div>
                </div>
                <div className="bg-white border-t border-slate-200 p-4 text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Developed by Nadim Anwar</p>
                </div>
            </div>
        )}

        {/* ANALYSIS SELECTION MODAL */}
        {showAnalysisSelection && (
            <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 text-center border-b border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-1">Unlock Analysis</h3>
                        <p className="text-sm text-slate-500">Choose your insight level</p>
                    </div>
                    <div className="p-4 space-y-4">
                        {/* FREE OPTION */}
                        <button
                            onClick={() => {
                                setShowAnalysisSelection(false);
                                setActiveTab('MISTAKES');
                            }}
                        className="w-full bg-white hover:bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl flex items-center justify-between transition-all group"
                        >
                            <div className="text-left">
                            <p className="font-black text-slate-800 text-lg group-hover:scale-105 transition-transform">Free Analysis</p>
                            <p className="text-xs text-slate-500 font-bold mt-1">Review Answers</p>
                            </div>
                        <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold">
                                <ChevronRight size={20} />
                            </div>
                        </button>

                        {/* RECOMMENDED NOTES OPTION */}
                        <button
                            onClick={() => {
                                setShowAnalysisSelection(false);
                                setActiveTab('RECOMMEND');
                            }}
                        className="w-full bg-white hover:bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl flex items-center justify-between transition-all group"
                        >
                            <div className="text-left">
                            <p className="font-black text-slate-800 text-lg group-hover:scale-105 transition-transform">Recommended Notes</p>
                            <p className="text-xs text-slate-500 font-bold mt-1">Weak Topic Notes & PDFs</p>
                            </div>
                        <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold">
                                <ChevronRight size={20} />
                            </div>
                        </button>

                        {/* PREMIUM OPTION */}
                        <button
                            onClick={() => {
                                setShowAnalysisSelection(false);
                                handleUltraAnalysis();
                                setActiveTab('AI');
                            }}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-2xl flex items-center justify-between transition-all shadow-xl shadow-slate-200 group relative overflow-hidden"
                        >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-left relative z-10">
                                <p className="font-black text-white text-lg group-hover:scale-105 transition-transform flex items-center gap-2">
                                Premium Analysis
                                </p>
                            <p className="text-xs text-slate-400 font-bold mt-1">Unlock AI Analysis</p>
                            </div>
                            <div className="text-right relative z-10">
                                <span className="block text-xl font-black text-yellow-400">{settings?.mcqAnalysisCostUltra ?? 20} CR</span>
                            </div>
                        </button>
                    </div>
                    <button onClick={() => setShowAnalysisSelection(false)} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600">Close</button>
                </div>
            </div>
        )}

        <CustomConfirm
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        />
        <div className="w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Header - Sticky */}
            <div className="bg-white text-slate-800 px-4 py-3 border-b border-slate-100 flex justify-between items-center z-10 sticky top-0 shrink-0">
                <div className="flex items-center gap-3">
                    {settings?.appLogo && (
                        <img src={settings.appLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50 border" />
                    )}
                    <div>
                        <h1 className="text-sm font-black uppercase text-slate-900 tracking-wide">
                            {settings?.appName || 'RESULT'}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400">Official Marksheet</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* TAB HEADER */}
            <div className="px-4 pt-2 pb-0 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide items-center">
                <button
                    onClick={() => setActiveTab('AI')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'AI' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <BrainCircuit size={14} className="inline mr-1 mb-0.5" /> Analysis
                </button>
                <button 
                    onClick={() => setActiveTab('OMR')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'OMR' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <Grid size={14} className="inline mr-1 mb-0.5" /> OMR
                </button>
                <button 
                    onClick={() => setActiveTab('MISTAKES')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'MISTAKES' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <XCircle size={14} className="inline mr-1 mb-0.5" /> Mistakes
                </button>
                <button
                    onClick={() => setActiveTab('MARKSHEET_1')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeTab === 'MARKSHEET_1' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                >
                    <FileText size={14} className="inline mr-1 mb-0.5" /> Official Marksheet
                </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div id="marksheet-content" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
                
                {/* 1. OMR SECTION */}
                {activeTab === 'OMR' && (
                    <div className="animate-in slide-in-from-bottom-4">
                         {renderOMRSection()}
                    </div>
                )}

                {/* 2. MISTAKES SECTION (Free Analysis) */}
                {activeTab === 'MISTAKES' && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {renderMistakesSection()}
                    </div>
                )}

                {/* 3. RECOMMENDED NOTES PAGE (Premium Style) */}
                {activeTab === 'RECOMMEND' && (
                    <div className="animate-in slide-in-from-bottom-4 h-full">
                        {renderRecommendationsSection()}
                    </div>
                )}


                {/* 4. AI ANALYSIS SECTION */}
                {activeTab === 'AI' && (
                    <div className="animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-3 px-2">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="text-violet-600" size={20} />
                                <h3 className="font-black text-slate-800 text-lg">Analysis & Recommendations</h3>
                            </div>
                            {ultraAnalysisResult && (
                                <div className="flex items-center gap-2">
                                    {/* VOICE SELECTOR */}
                                    <select 
                                        className="text-[10px] p-1.5 border rounded-lg bg-white max-w-[120px] truncate"
                                        value={selectedVoice?.name || ''}
                                        onChange={(e) => {
                                            const v = [...voices.hindi, ...voices.indianEnglish, ...voices.others].find(voice => voice.name === e.target.value);
                                            if(v) setSelectedVoice(v);
                                        }}
                                    >
                                        <optgroup label="Hindi">
                                            {voices.hindi.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                        </optgroup>
                                        <optgroup label="Indian English">
                                            {voices.indianEnglish.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                        </optgroup>
                                        <optgroup label="Others">
                                            {voices.others.slice(0, 5).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                        </optgroup>
                                    </select>

                                    {/* SPEED SELECTOR */}
                                    <select 
                                        className="text-[10px] p-1.5 border rounded-lg bg-white font-bold"
                                        value={speechRate}
                                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                                    >
                                        <option value={0.75}>0.75x</option>
                                        <option value={1.0}>1x</option>
                                        <option value={1.25}>1.25x</option>
                                        <option value={1.5}>1.5x</option>
                                        <option value={2.0}>2x</option>
                                    </select>

                                    <button 
                                        onClick={() => toggleSpeech(getAnalysisTextForSpeech())} 
                                        className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-white text-slate-600 shadow-sm border'}`}
                                        title="Listen (20 Coins)"
                                    >
                                        {isSpeaking ? <StopCircle size={18} /> : <Play size={18} />}
                                    </button>
                                    {/* DOWNLOAD AUDIO PLACEHOLDER */}
                                    <button 
                                        onClick={() => alert("Audio Download is currently disabled on Web. Use App for offline listening.")}
                                        className="p-2 rounded-full bg-white text-slate-600 shadow-sm border hover:bg-slate-50 transition-colors opacity-50"
                                        title="Download Audio (App Only)"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {!ultraAnalysisResult ? (
                            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-6 text-center text-white shadow-lg">
                                <BrainCircuit size={48} className="mx-auto mb-4 opacity-80" />
                                <h4 className="text-xl font-black mb-2">Unlock Topic Breakdown</h4>
                                <p className="text-indigo-100 text-sm mb-6 max-w-xs mx-auto">
                                    Get AI-powered insights on your weak areas, study plan, and topic-wise performance graph.
                                </p>
                                <button 
                                    onClick={() => handleUltraAnalysis()} 
                                    disabled={isLoadingUltra}
                                    className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-black shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 mx-auto disabled:opacity-80"
                                >
                                    {isLoadingUltra ? <span className="animate-spin">⏳</span> : <UnlockIcon />}
                                    {isLoadingUltra ? 'Analyzing...' : `Unlock Analysis (${settings?.mcqAnalysisCostUltra ?? 20} Coins)`}
                                </button>
                            </div>
                        ) : (
                            renderAnalysisContent()
                        )}
                    </div>
                )}

                {/* MARKSHEET STYLES */}
                {activeTab === 'MARKSHEET_1' && renderMarksheetStyle1()}
                {activeTab === 'MARKSHEET_2' && renderMarksheetStyle2()}

            </div>

            {/* Footer Actions */}
            <div className="bg-white p-4 border-t border-slate-100 flex gap-2 justify-center z-10 shrink-0 flex-col sm:flex-row">
                {onViewAnalysis && (
                    <button onClick={() => setShowAnalysisSelection(true)} className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl font-bold text-xs shadow-sm border border-slate-900 hover:bg-slate-800 flex justify-center gap-2">
                        <BrainCircuit size={16} /> Analysis
                    </button>
                )}
                
                <button onClick={handleShare} className="flex-1 bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-xs shadow hover:bg-green-700 flex justify-center gap-2">
                    <Share2 size={16} /> Share Result
                </button>
                
                <div className="flex gap-2 flex-1">
                     <button onClick={() => handleDownload()} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold text-xs hover:bg-slate-200 flex-1 flex justify-center items-center gap-2">
                        <Download size={16} /> {['MARKSHEET_1','MARKSHEET_2'].includes(activeTab) ? 'Download Marksheet' : 'Download Page'}
                    </button>
                    {/* DOWNLOAD ALL BUTTON */}
                    {!['MARKSHEET_1','MARKSHEET_2'].includes(activeTab) && (
                         <button onClick={handleDownloadAll} className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold text-xs hover:bg-slate-800 flex-1 flex justify-center items-center gap-2">
                             <Download size={16} /> Download Full Analysis
                         </button>
                    )}
                </div>
            </div>
             
             {/* STRICT BRANDING FOOTER */}
             <div className="text-center py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Developed by Nadim Anwar</p>
             </div>
        </div>

        {/* RECOMMENDATION MODAL */}
        {showRecModal && (
            <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <Lightbulb size={20} className="text-yellow-500" /> Recommended for You
                        </h3>
                        <button onClick={() => setShowRecModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={16} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {recLoading ? (
                            <div className="text-center py-8 text-slate-400 font-bold animate-pulse">Finding best notes...</div>
                        ) : recommendations.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">No specific notes found for your weak topics. Try reviewing the chapter again!</div>
                        ) : (
                            <>
                                {/* FREE RECOMMENDATIONS */}
                                {recommendations.filter(r => !r.isPremium).length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Free Material</h4>
                                        {recommendations.filter(r => !r.isPremium).map((rec, i) => (
                                            <div key={`free-${i}`} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{rec.title}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1 bg-white px-2 py-0.5 rounded w-fit border">{rec.topic}</p>
                                                </div>
                                                <button
                                                    className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200"
                                                    onClick={() => {
                                                        if (rec.type === 'FREE_NOTES_LINK') {
                                                            if (onLaunchContent) {
                                                                onLaunchContent({
                                                                    id: result.chapterId,
                                                                    title: result.chapterTitle,
                                                                    type: 'PDF',
                                                                    subjectName: result.subjectName,
                                                                });
                                                            } else {
                                                                alert("Please go to the Chapter page and open Free Notes.");
                                                            }
                                                        } else if (onLaunchContent) {
                                                            onLaunchContent({
                                                                id: `REC_FREE_${i}`,
                                                                title: rec.title,
                                                                type: 'PDF',
                                                                directResource: { url: rec.url, access: rec.access }
                                                            });
                                                        }
                                                    }}
                                                >
                                                    Read
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* PREMIUM RECOMMENDATIONS */}
                                {recommendations.filter(r => r.isPremium).length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-yellow-600 uppercase tracking-widest border-b pb-2">Premium Resources</h4>
                                        {recommendations.filter(r => r.isPremium).map((rec, i) => (
                                            <div key={`prem-${i}`} className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{rec.title}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1 bg-white px-2 py-0.5 rounded w-fit border">{rec.topic}</p>
                                                    <span className="text-[9px] text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded ml-1 font-bold">PREMIUM</span>
                                                </div>
                                                <button
                                                    className="text-xs font-bold text-yellow-700 bg-yellow-200 px-3 py-1.5 rounded-lg hover:bg-yellow-300 shadow-sm"
                                                    onClick={() => {
                                                        if (onLaunchContent) {
                                                            onLaunchContent({
                                                                id: `REC_PREM_${i}`,
                                                                title: rec.title,
                                                                type: 'PDF',
                                                                directResource: { url: rec.url, access: rec.access }
                                                            });
                                                        }
                                                    }}
                                                >
                                                    Unlock
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* HIDDEN PRINT CONTAINER FOR DOWNLOAD ALL */}
        {isDownloadingAll && (
            <div id="full-analysis-report" className="absolute top-0 left-0 w-[800px] bg-white z-[-1] p-8 space-y-8 pointer-events-none">
                {/* Header */}
                <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
                    <h1 className="text-4xl font-black text-slate-900 uppercase">{settings?.appName || 'INSTITUTE'}</h1>
                    <p className="text-lg font-bold text-slate-500">Comprehensive Performance Report</p>
                    <p className="text-sm font-bold text-slate-400 mt-2">{user.name} | {new Date().toLocaleDateString()}</p>
                </div>
                
                {/* 1. STATS */}
                <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-blue-600 pl-3 uppercase">1. Performance Summary</h2>
                    {renderStatsSection()}
                </div>

                {/* 2. MISTAKES */}
                {result.wrongQuestions && result.wrongQuestions.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-red-600 pl-3 uppercase">2. Mistakes Review</h2>
                        {renderMistakesSection()}
                    </div>
                )}

                {/* 3. AI ANALYSIS */}
                {ultraAnalysisResult && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-violet-600 pl-3 uppercase">3. AI Deep Analysis</h2>
                        {renderAnalysisContent()}
                    </div>
                )}

                {/* 4. OMR */}
                {hasOMR && (
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-4 border-l-8 border-slate-600 pl-3 uppercase">4. OMR Sheet</h2>
                        {renderOMRSection()}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center border-t border-slate-200 pt-4 mt-8">
                    <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Developed by {devName}</p>
                </div>
            </div>
        )}
    </div>
  );
};

const UnlockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);
