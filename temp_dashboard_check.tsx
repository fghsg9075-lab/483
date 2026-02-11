      // 1. HOME TAB
      if (activeTab === 'HOME') {
          return (
              <div className="space-y-4 pb-24">
                {/* NEW HEADER DESIGN */}
                <div className="bg-white p-4 rounded-b-3xl shadow-sm border-b border-slate-200 mb-2 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSidebar(true)}
                            className="bg-slate-50 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <List size={24} className="text-slate-600" />
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 leading-none">
                                {settings?.appName || 'Student App'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{user.displayId || user.id.slice(0,6)}</span>
                                {user.role === 'ADMIN' && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-bold">ADMIN</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Credits</span>
                            <span className="font-black text-blue-600 flex items-center gap-1">
                                <Crown size={14} className="fill-blue-600"/> {user.credits}
                            </span>
                        </div>
                        <div className="flex flex-col items-end border-l pl-3 border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Streak</span>
                            <span className="font-black text-orange-500 flex items-center gap-1">
                                <Zap size={14} className="fill-orange-500"/> {user.streak}
                            </span>
                        </div>
                        <button
                            onClick={() => setEditMode(true)}
                            className="bg-slate-50 p-2 rounded-full hover:bg-slate-100"
                        >
                            <Settings size={20} className="text-slate-400"/>
                        </button>
                    </div>
                </div>

                {/* PERFORMANCE GRAPH */}
                <DashboardSectionWrapper id="section_performance" label="Performance">
                    <PerformanceGraph
                        history={user.mcqHistory || []}
                        user={user}
                        onViewNotes={(topic) => {
                            // Find note by topic logic or open PDF tab
                            // For simplicity, switch to PDF tab and trigger search if possible
                            onTabChange('PDF');
                            // We can't auto-search yet without a search context in PDF view, but this navigates user.
                        }}
                    />
                </DashboardSectionWrapper>

                {/* STUDY GOAL TIMER */}
                <DashboardSectionWrapper id="section_timer" label="Study Goal">
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <Timer size={20} className="text-orange-500" /> Daily Goal
                                </h3>
                                <p className="text-xs text-slate-500">Set your study target</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-slate-800">
                                    {Math.floor(dailyTargetSeconds / 3600)}h {Math.floor((dailyTargetSeconds % 3600) / 60)}m
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {[0.5, 1, 2].map(h => (
                                <button
                                    key={h}
                                    onClick={() => {
                                        setDailyTargetSeconds(h * 3600);
                                        localStorage.setItem(`nst_goal_${user.id}`, h.toString());
                                    }}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${dailyTargetSeconds === h * 3600 ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                >
                                    {h} Hour{h > 1 ? 's' : ''}
                                </button>
                            ))}
                            <button
                                onClick={() => {
                                    setDailyTargetSeconds(3 * 3600);
                                    localStorage.setItem(`nst_goal_${user.id}`, '3');
                                }}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${dailyTargetSeconds === 3 * 3600 ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                            >
                                Default (3h)
                            </button>
                            <button
                                onClick={() => {
                                    const custom = prompt("Enter hours (1-12):");
                                    if (custom) {
                                        const h = parseFloat(custom);
                                        if (h > 0 && h <= 12) {
                                            setDailyTargetSeconds(h * 3600);
                                            localStorage.setItem(`nst_goal_${user.id}`, h.toString());
                                        }
                                    }
                                }}
                                className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200"
                            >
                                Custom
                            </button>
                        </div>
                    </div>
                </DashboardSectionWrapper>

                {/* STUDY HUB LINKS (MOVED FROM BOTTOM) */}
                <DashboardSectionWrapper id="section_hub_links" label="Study Hub">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Videos Button */}
                        {hasPermission('f1') && (
                            <button
                                onClick={() => {
                                    setSelectedSubject({ id: 'universal', name: 'Special' } as any);
                                    setSelectedChapter({ id: 'UNIVERSAL', title: 'Featured Lectures' } as any);
                                    setContentViewStep('PLAYER');
                                    setFullScreen(true);
                                    onTabChange('VIDEO');
                                    localStorage.setItem('nst_last_read_update', Date.now().toString());
                                    setHasNewUpdate(false);
                                }}
                                className="bg-gradient-to-br from-red-500 to-rose-600 p-6 rounded-3xl shadow-lg shadow-red-200 flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="bg-white/20 p-4 rounded-full text-white backdrop-blur-sm">
                                    <Play size={32} fill="currentColor" />
                                </div>
                                <span className="font-black text-white text-lg tracking-wide uppercase">Videos</span>
                                {hasNewUpdate && <span className="absolute top-4 right-4 w-3 h-3 bg-white rounded-full animate-pulse"></span>}
                            </button>
                        )}

                        {/* Courses Button */}
                        <button
                            onClick={() => { onTabChange('COURSES'); setContentViewStep('SUBJECTS'); }}
                            className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-3 group active:scale-95 transition-all relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="bg-white/20 p-4 rounded-full text-white backdrop-blur-sm">
                                <Book size={32} />
                            </div>
                            <span className="font-black text-white text-lg tracking-wide uppercase">Courses</span>
                        </button>
                    </div>
                </DashboardSectionWrapper>

                {/* HERO SECTION */}
                  <div className="space-y-4 mb-6">

                      {/* SPECIAL DISCOUNT BANNER (Kept separate as requested) */}
                      {showDiscountBanner && discountTimer && (
                          <div
                              onClick={() => onTabChange('STORE')}
                              className="mx-1 mb-4 relative p-[2px] rounded-2xl overflow-hidden cursor-pointer group"
                          >
                              {/* Rotating Border Animation */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" style={{ animationDuration: '3s' }}></div>
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600 animate-border-rotate"></div>

                              <div className="relative bg-gradient-to-r from-blue-900 to-slate-900 p-4 rounded-2xl shadow-xl overflow-hidden">
                                  {/* Glossy Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

                                  <div className="flex justify-between items-center relative z-10 text-white">
                                      <div>
                                          <h3 className="text-lg font-black italic flex items-center gap-2">
                                              <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                                              {discountStatus === 'WAITING' ? '⚡ SALE STARTING SOON' : `🔥 ${settings?.specialDiscountEvent?.eventName || 'LIMITED TIME OFFER'} IS LIVE!`}
                                          </h3>
                                          <p className="text-xs font-bold text-blue-200">
                                              {discountStatus === 'WAITING' ? 'Get ready for massive discounts!' : `Get ${settings?.specialDiscountEvent?.discountPercent || 50}% OFF on all premium plans!`}
                                          </p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">{discountStatus === 'WAITING' ? 'STARTS IN' : 'ENDS IN'}</p>
                                          <p className="text-2xl font-black font-mono leading-none text-white drop-shadow-md">{discountTimer}</p>
                                      </div>
                                  </div>

                                  {/* Moving Shine Effect */}
                                  <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
                              </div>
                          </div>
                      )}

                      {/* NEW: STACKED ACTION GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 mx-1">
                          {/* 1. Subscription Buttons */}
                          <div className="grid grid-cols-2 gap-3">
                              {hasPermission('f11') && <button onClick={() => onTabChange('STORE')} className="relative h-24 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-2xl overflow-hidden shadow-lg flex flex-col items-center justify-center border border-purple-500/30 p-2 group">
                                  <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Crown size={48} className="text-white"/></div>
                                  <Crown size={24} className="text-yellow-400 mb-1"/>
                                  <span className="text-sm font-black text-white italic">ULTRA SUB</span>
                                  <span className="text-[8px] text-purple-200">Unlock Everything</span>
                              </button>}

                              {hasPermission('f11') && <button onClick={() => onTabChange('STORE')} className="relative h-24 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl overflow-hidden shadow-lg flex flex-col items-center justify-center border border-blue-400/30 p-2 group">
                                  <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Star size={48} className="text-white"/></div>
                                  <Star size={24} className="text-white mb-1"/>
                                  <span className="text-sm font-black text-white italic">BASIC SUB</span>
                                  <span className="text-[8px] text-blue-100">Starter Pack</span>
                              </button>}
                          </div>

                          {/* 2. Auto-Sliding Ultra Media Banner (Non-Clickable) */}
                          <div className="h-32 rounded-2xl overflow-hidden shadow-lg relative border-2 border-slate-900">
                              {/* Overlay controls disabled */}
                              <div className="absolute inset-0 z-20 bg-transparent"></div>

                              <BannerCarousel
                                  slides={[
                                      { id: '1', image: 'https://img.freepik.com/free-vector/gradient-education-poster-template_23-2150338779.jpg', title: 'ULTRA VIDEO', subtitle: 'HD Lectures', link: '' },
                                      { id: '2', image: 'https://img.freepik.com/free-vector/gradient-education-flyer-template_23-2150338784.jpg', title: 'ULTRA PDF', subtitle: 'Premium Notes', link: '' },
                                      { id: '3', image: 'https://img.freepik.com/free-vector/online-tutorials-concept_52683-37480.jpg', title: 'ULTRA MCQ', subtitle: 'Test Series', link: '' },
                                      { id: '4', image: 'https://img.freepik.com/free-vector/audiobook-concept-illustration_114360-6070.jpg', title: 'ULTRA AUDIO', subtitle: 'Listen & Learn', link: '' }
                                  ]}
                                  interval={2000} // Fast Auto Skip
                                  autoPlay={true}
                                  showDots={false}
                                  showArrows={false}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex justify-between items-center z-10 backdrop-blur-sm">
                                  <span className="text-xs font-black text-white flex items-center gap-1"><Crown size={12} className="text-yellow-400"/> PREMIUM CONTENT</span>
                                  <span className="text-[9px] text-slate-300 uppercase tracking-widest">Auto-Preview</span>
                              </div>
                          </div>

                          {/* 3. AI & Custom Buttons */}
                          <div className="grid grid-cols-3 gap-3 md:col-span-2">
                              {hasPermission('f101') && <button onClick={() => onTabChange('AI_CHAT')} className="h-24 bg-indigo-600 rounded-2xl shadow-lg flex flex-col items-center justify-center text-white relative overflow-hidden group">
                                  <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  <MessageSquare size={28} className="mb-1 relative z-10"/>
                                  <span className="text-xs font-black relative z-10">AI CHAT</span>
                                  <span className="text-[8px] opacity-70 relative z-10">Ask Anything</span>
                              </button>}

                              {hasPermission('f36') && <button onClick={() => setShowAiModal(true)} className="h-24 bg-sky-500 rounded-2xl shadow-lg flex flex-col items-center justify-center text-white relative overflow-hidden group">
                                  <div className="absolute inset-0 bg-sky-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  <BrainCircuit size={28} className="mb-1 relative z-10"/>
                                  <span className="text-xs font-black relative z-10">AI NOTES</span>
                                  <span className="text-[8px] opacity-70 relative z-10">Generate</span>
                              </button>}

                              {hasPermission('f32') && <button onClick={() => onTabChange('CUSTOM_PAGE')} className="h-24 bg-slate-800 rounded-2xl shadow-lg flex flex-col items-center justify-center text-white relative overflow-hidden group">
                                  <div className="absolute inset-0 bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                  <Layout size={28} className="mb-1 relative z-10"/>
                                  <span className="text-xs font-black relative z-10">CUSTOM</span>
                                  <span className="text-[8px] opacity-70 relative z-10">Explore Page</span>
                              </button>}
                          </div>
              </div>
          );
      }
