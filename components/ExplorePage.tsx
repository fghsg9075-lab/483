import React, { useState, useEffect } from 'react';
import { User, SystemSettings, WeeklyTest, Challenge20, StudentTab } from '../types';
import { BannerCarousel } from './BannerCarousel';
import { Sparkles, BrainCircuit, Rocket, Zap, ArrowRight, Crown, Headphones, FileText, CheckCircle, Video as VideoIcon } from 'lucide-react';
import { SpeakButton } from './SpeakButton';
import { generateMorningInsight } from '../services/morningInsight';
import { getActiveChallenges } from '../services/questionBank';

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

    // --- DISCOUNT LOGIC ---
    const [discountStatus, setDiscountStatus] = useState<'WAITING' | 'ACTIVE' | 'NONE'>('NONE');
    const [discountTimer, setDiscountTimer] = useState<string | null>(null);

    useEffect(() => {
        const evt = settings?.specialDiscountEvent;
        const formatDiff = (diff: number) => {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
        };

        const checkStatus = () => {
            if (!evt?.enabled) {
                setDiscountStatus('NONE');
                return;
            }
            const now = Date.now();
            const startsAt = evt.startsAt ? new Date(evt.startsAt).getTime() : now;
            const endsAt = evt.endsAt ? new Date(evt.endsAt).getTime() : now;

            if (now < startsAt) {
                setDiscountStatus('WAITING');
                setDiscountTimer(formatDiff(startsAt - now));
            } else if (now < endsAt) {
                setDiscountStatus('ACTIVE');
                setDiscountTimer(formatDiff(endsAt - now));
            } else {
                setDiscountStatus('NONE');
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 1000);
        return () => clearInterval(interval);
    }, [settings?.specialDiscountEvent]);

    // --- MORNING INSIGHT ---
    useEffect(() => {
        const loadMorningInsight = async () => {
            const now = new Date();
            if (now.getHours() >= 6) {
                const today = now.toDateString();
                const savedBanner = localStorage.getItem('nst_morning_banner');
                if (savedBanner) {
                    const parsed = JSON.parse(savedBanner);
                    if (parsed.date === today) {
                        setMorningBanner(parsed);
                        return;
                    }
                }
                const isGen = localStorage.getItem(`nst_insight_gen_${today}`);
                if (!isGen) {
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

    // --- CHALLENGES ---
    useEffect(() => {
        const loadChallenges = async () => {
            if (user.classLevel) {
                const active = await getActiveChallenges(user.classLevel);
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

    // --- BANNER RENDERING HELPERS ---
    const renderSimpleBanner = (title: string, subtitle: string, bgClass: string, icon: React.ReactNode, onClick: () => void) => (
        <div
            onClick={onClick}
            className={`w-full h-48 p-6 relative overflow-hidden flex flex-col justify-center text-white cursor-pointer ${bgClass} rounded-none`}
        >
            <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mb-10"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                        {icon}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Featured</span>
                </div>
                <h2 className="text-2xl font-black mb-1 leading-tight">{title}</h2>
                <p className="text-sm opacity-90 font-medium max-w-[85%]">{subtitle}</p>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20">
                <ArrowRight size={20} />
            </div>
        </div>
    );

    const userTier = user.subscriptionTier === 'FREE' ? 'FREE' : user.subscriptionTier === 'LIFETIME' ? 'PREMIUM' : 'PREMIUM';
    const customBanners = (settings?.exploreBanners || [])
        .filter(b => b.enabled)
        .filter(b => b.targetAudience === 'ALL' || b.targetAudience === userTier)
        .sort((a,b) => a.priority - b.priority);

    return (
        <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4">

            <section>
                <div className="flex items-center gap-2 mb-4 px-4 pt-4">
                    <Sparkles className="text-yellow-500" />
                    <h2 className="text-xl font-black text-slate-800">Discover</h2>
                </div>

                <BannerCarousel autoPlay={true} className="shadow-xl mx-4 rounded-3xl overflow-hidden min-h-[192px]">

                    {/* 1. MORNING INSIGHT */}
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
                        </div>
                    )}

                    {/* 2. DISCOUNT EVENT */}
                    {discountStatus !== 'NONE' && (
                        <div
                            onClick={() => onTabChange('STORE')}
                            className="w-full h-48 bg-gradient-to-r from-red-600 to-rose-600 p-6 relative overflow-hidden flex flex-col justify-center text-white cursor-pointer"
                        >
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 bg-yellow-400 text-red-900 rounded-full text-[10px] font-black tracking-widest mb-2 shadow-lg animate-pulse">
                                    {discountStatus === 'WAITING' ? 'COMING SOON' : 'LIMITED OFFER'}
                                </div>
                                <h3 className="text-2xl font-black mb-1">{settings?.specialDiscountEvent?.eventName || 'Special Offer'}</h3>
                                <p className="text-white/90 text-sm font-bold flex items-center gap-2">
                                    <Zap size={16} className="text-yellow-300" />
                                    {discountStatus === 'WAITING' ? `Starts in ${discountTimer}` : `Ends in ${discountTimer}`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 3. ACTIVE CHALLENGES */}
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
                        </div>
                    ))}

                    {/* 4. PREMIUM VIDEO SLOT */}
                    {settings?.contentVisibility?.VIDEO !== false && renderSimpleBanner(
                        "Premium Video Lectures",
                        "Watch high-quality animated lessons & concepts.",
                        "bg-gradient-to-r from-blue-600 to-indigo-600",
                        <VideoIcon className="text-white" size={20} />,
                        () => onTabChange('VIDEO')
                    )}

                    {/* 5. NOTES SLOT */}
                    {settings?.contentVisibility?.PDF !== false && renderSimpleBanner(
                        "Smart Notes Library",
                        "Concise, exam-oriented notes for quick revision.",
                        "bg-gradient-to-r from-emerald-500 to-teal-600",
                        <FileText className="text-white" size={20} />,
                        () => onTabChange('PDF')
                    )}

                    {/* 6. MCQ SLOT */}
                    {settings?.contentVisibility?.MCQ !== false && renderSimpleBanner(
                        "MCQ Practice Zone",
                        "Test your knowledge and improve your speed.",
                        "bg-gradient-to-r from-violet-600 to-purple-600",
                        <CheckCircle className="text-white" size={20} />,
                        () => onTabChange('MCQ')
                    )}

                    {/* 7. AUDIO SLOT */}
                    {settings?.contentVisibility?.AUDIO !== false && renderSimpleBanner(
                        "Audio Learning",
                        "Listen to podcasts and lectures on the go.",
                        "bg-gradient-to-r from-pink-500 to-rose-500",
                        <Headphones className="text-white" size={20} />,
                        () => onTabChange('AUDIO')
                    )}

                    {/* 8. AI TOUR SLOT */}
                    {settings?.isAiEnabled && renderSimpleBanner(
                        "AI Personal Tutor",
                        "Stuck? Ask your doubts and get instant answers.",
                        "bg-slate-900",
                        <BrainCircuit className="text-blue-400" size={20} />,
                        onOpenAiChat
                    )}

                    {/* 9. CUSTOM ADMIN BANNERS */}
                    {customBanners.map(banner => (
                        <div
                            key={banner.id}
                            onClick={() => {
                                if (banner.actionUrl) {
                                    if (banner.actionUrl.startsWith('http')) window.open(banner.actionUrl, '_blank');
                                    else onTabChange(banner.actionUrl as StudentTab);
                                }
                            }}
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

                </BannerCarousel>
            </section>

            {/* ASK YOUR DOUBTS */}
            {settings?.isAiEnabled && (
                <section className="px-4">
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

                    <button
                        onClick={onOpenAiChat}
                        className="w-full mt-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Rocket size={18} className="text-yellow-300" />
                        Take AI Tour
                    </button>
                </section>
            )}
        </div>
    );
};
