import React, { useState, useEffect } from 'react';
import { User, SystemSettings, WeeklyTest, Challenge20 } from '../types';
import { BannerCarousel } from './BannerCarousel';
import { Sparkles, BrainCircuit, Rocket, Zap, ArrowRight, Crown } from 'lucide-react';
import { SpeakButton } from './SpeakButton';
import { generateMorningInsight } from '../services/morningInsight';
import { getActiveChallenges } from '../services/questionBank';
import { StudentTab } from '../types';

interface Props {
    user: User;
    settings?: SystemSettings;
    onTabChange: (tab: StudentTab) => void;
    onStartWeeklyTest?: (test: WeeklyTest) => void;
    onOpenAiChat: () => void;
}

export const ExplorePage: React.FC<Props> = ({ user, settings, onTabChange, onStartWeeklyTest, onOpenAiChat }) => {
    const [morningBanner, setMorningBanner] = useState<any>(null);
    const [challenges20, setChallenges20] = useState<Challenge20[]>([]);

    // --- LOAD MORNING INSIGHT ---
    useEffect(() => {
        const loadMorningInsight = async () => {
            const now = new Date();
            if (now.getHours() >= 6) { // Active from 6 AM
                const today = now.toDateString();
                const savedBanner = localStorage.getItem('nst_morning_banner');

                if (savedBanner) {
                    const parsed = JSON.parse(savedBanner);
                    if (parsed.date === today) {
                        setMorningBanner(parsed);
                        return;
                    }
                }
                // If not found, we don't generate here to avoid double-generation if Dashboard does it.
                // We assume Dashboard or a background service handles generation, or we just rely on what's there.
                // Actually, let's allow generation here if missing, same as Dashboard.
                const isGen = localStorage.getItem(`nst_insight_gen_${today}`);
                if (!isGen) {
                     // Trigger generation logic (simplified)
                     const logs = JSON.parse(localStorage.getItem('nst_universal_analysis_logs') || '[]');
                     if (logs.length > 0) {
                         try {
                             await generateMorningInsight(logs, settings, (banner) => {
                                 localStorage.setItem('nst_morning_banner', JSON.stringify(banner));
                                 setMorningBanner(banner);
                             });
                         } catch(e) {}
                     }
                }
            }
        };
        loadMorningInsight();
    }, [settings]);

    // --- LOAD CHALLENGES ---
    useEffect(() => {
        const loadChallenges = async () => {
            if (user.classLevel) {
                const active = await getActiveChallenges(user.classLevel);
                // Filter strict active status
                setChallenges20(active.filter(c => c.isActive));
            }
        };
        loadChallenges();
    }, [user.classLevel]);

    const startChallenge20 = (challenge: Challenge20) => {
        const mappedTest: WeeklyTest = {
            id: challenge.id,
            name: challenge.title,
            description: challenge.description || 'Challenge',
            isActive: true,
            classLevel: challenge.classLevel,
            questions: challenge.questions,
            totalQuestions: challenge.questions.length,
            passingScore: Math.ceil(challenge.questions.length * 0.5),
            createdAt: challenge.createdAt,
            durationMinutes: challenge.durationMinutes || 15,
            autoSubmitEnabled: true
        };
        if (onStartWeeklyTest) onStartWeeklyTest(mappedTest);
    };

    const handleBannerAction = (banner: any) => {
        if (!banner.actionUrl) return;
        if (banner.actionUrl.startsWith('http')) {
            window.open(banner.actionUrl, '_blank');
        } else {
            // Assume Tab ID
            onTabChange(banner.actionUrl as StudentTab);
        }
    };

    const userTier = user.subscriptionTier === 'FREE' ? 'FREE' : user.subscriptionTier === 'LIFETIME' ? 'PREMIUM' : 'PREMIUM';

    const customBanners = (settings?.exploreBanners || [])
        .filter(b => b.enabled)
        .filter(b => b.targetAudience === 'ALL' || b.targetAudience === userTier)
        .sort((a,b) => a.priority - b.priority);

    return (
        <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4">

            {/* 1. BANNERS SECTION */}
            <section>
                <div className="flex items-center gap-2 mb-4 px-2">
                    <Sparkles className="text-yellow-500" />
                    <h2 className="text-xl font-black text-slate-800">Discover</h2>
                </div>

                <BannerCarousel className="shadow-xl mx-2 min-h-[192px]">

                    {/* A. MORNING INSIGHT (Priority) */}
                    {morningBanner && settings?.showMorningInsight !== false && (
                        <div className="w-full h-48 bg-gradient-to-r from-orange-100 to-amber-100 p-6 relative overflow-hidden flex flex-col justify-center">
                             <div className="relative z-10">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-orange-900 flex items-center gap-2 text-lg">
                                        <Sparkles size={20} className="text-orange-600" /> {morningBanner.title || 'Morning Insight'}
                                    </h3>
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-200 px-2 py-0.5 rounded-full">{morningBanner.date}</span>
                                </div>
                                <p className="text-sm text-orange-800 italic mb-3 font-medium">"{morningBanner.wisdom}"</p>
                                <div className="flex items-center gap-2">
                                    <SpeakButton text={`${morningBanner.title}. ${morningBanner.wisdom}.`} className="text-orange-600 hover:bg-orange-200 p-2 rounded-full" iconSize={20} />
                                    <span className="text-xs font-bold text-orange-700">Listen to Daily Wisdom</span>
                                </div>
                            </div>
                            {/* Decoration */}
                            <div className="absolute right-0 bottom-0 w-32 h-32 bg-orange-300/20 rounded-full blur-2xl"></div>
                        </div>
                    )}

                    {/* B. DYNAMIC BANNERS (ADMIN) */}
                    {customBanners.map(banner => (
                        <div
                            key={banner.id}
                            onClick={() => handleBannerAction(banner)}
                            className={`w-full h-48 p-6 relative overflow-hidden flex flex-col justify-center text-white cursor-pointer ${banner.backgroundStyle || 'bg-slate-800'}`}
                        >
                            {banner.imageUrl ? (
                                <div className="absolute inset-0">
                                    <img src={banner.imageUrl} className="w-full h-full object-cover opacity-50" alt="Banner" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
                                </div>
                            ) : (
                                <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mb-10"></div>
                            )}

                            <div className="relative z-10">
                                <h2 className="text-3xl font-black mb-2 leading-tight">{banner.title}</h2>
                                {banner.subtitle && <p className="text-sm opacity-90 mb-4 font-medium max-w-[80%]">{banner.subtitle}</p>}
                                {banner.actionLabel && (
                                    <button className="bg-white text-slate-900 px-5 py-2 rounded-xl font-bold text-xs shadow-lg uppercase tracking-wider hover:scale-105 transition-transform">
                                        {banner.actionLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* C. ACTIVE CHALLENGES */}
                    {settings?.showChallengesBanner !== false && challenges20.map(c => (
                        <div key={c.id} className="w-full h-48 bg-slate-900 p-6 relative overflow-hidden flex flex-col justify-center text-white">
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 bg-indigo-500/20 rounded-full text-[10px] font-black tracking-widest mb-2 border border-indigo-500/30 text-indigo-300">
                                    🚀 LIVE CHALLENGE
                                </div>
                                <h3 className="text-2xl font-black mb-1">{c.title}</h3>
                                <p className="text-slate-400 text-xs mb-4">{c.questions.length} Questions • {c.durationMinutes} Mins</p>
                                <button
                                    onClick={() => startChallenge20(c)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg transition-transform active:scale-95"
                                >
                                    Accept Challenge
                                </button>
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
                        </div>
                    ))}

                    {/* D. AI PROMO (If Enabled & Not Covered by Custom) */}
                    {settings?.isAiEnabled && settings?.showAiPromo !== false && !customBanners.some(b => b.actionUrl === 'AI_CHAT') && (
                        <div
                            onClick={onOpenAiChat}
                            className="w-full h-48 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 relative overflow-hidden cursor-pointer flex flex-col justify-center text-white"
                        >
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <BrainCircuit className="text-yellow-300" size={24} />
                                    <span className="text-xs font-black bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">AI TUTOR</span>
                                </div>
                                <h3 className="text-2xl font-black italic">{settings?.aiName || 'AI Assistant'}</h3>
                                <p className="text-indigo-100 text-sm mt-1 max-w-[80%]">Ask any doubt and get instant answers.</p>
                            </div>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 p-4 rounded-full backdrop-blur-md border border-white/20">
                                <ArrowRight size={24} />
                            </div>
                        </div>
                    )}
                </BannerCarousel>
            </section>

            {/* 2. ASK YOUR DOUBTS SECTION */}
            {settings?.isAiEnabled && (
                <section className="px-2">
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-indigo-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 z-0"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                    <BrainCircuit size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">Ask Your Doubts</h3>
                                    <p className="text-xs text-slate-500 font-bold">Powered by AI</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                Stuck on a concept? Need a quick explanation? Ask our AI Tutor anything!
                            </p>

                            <button
                                onClick={onOpenAiChat}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 group"
                            >
                                <span className="group-hover:animate-pulse">✨</span> Start Chatting
                            </button>
                        </div>
                    </div>
                </section>
            )}

             {/* 3. CUSTOM PAGE ENTRY */}
             <section className="px-2">
                 <div
                    onClick={() => onTabChange('CUSTOM_PAGE')}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden cursor-pointer group"
                >
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black mb-1">More Features</h3>
                            <p className="text-pink-100 text-sm">Explore extra content & updates</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform">
                            <ArrowRight size={24} />
                        </div>
                    </div>
                 </div>
             </section>
        </div>
    );
};
