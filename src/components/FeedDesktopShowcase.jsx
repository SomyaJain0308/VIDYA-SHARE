import React from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Loader2, ShieldCheck, ShoppingBag } from 'lucide-react';

export default function FeedDesktopShowcase({
  NETWORK_CITY,
  activeListingsCount,
  liveBooksCount,
  hasLiveListings,
  onOpenRequests,
  showStageFilters,
  setShowStageFilters,
  showSavedOnly,
  setShowSavedOnly,
  visibleSavedCount,
  bookSubjectFilter,
  setBookSubjectFilter,
  bookSubjectOptions,
  sortMode,
  setSortMode,
  sortOptions,
  stageRef,
  handleStageMouseMove,
  resetStageTilt,
  featuredGhostWord,
  featuredBook,
  featuredStatusMeta,
  timeAgo,
  featuredLocationLine,
  featuredMetadata,
  featuredTrust,
  sellerProfiles,
  sellerStatsMap,
  featuredIsSaving,
  featuredSaved,
  toggleSaveOffer,
  featuredConnectLink,
  featuredCanReserve,
  openReserveModal,
  featuredReserveSent,
  shiftFeaturedBook,
  filteredBookNotices,
  featuredBookIndex,
  setFeaturedBookIndex,
  featuredCountLabel,
  recentNotices,
  activeFilterCount,
  categories,
  categoryFilter,
  setCategoryFilter,
  getCategoryLabel,
}) {
  return (
    <>
      <div className="hidden md:block">
        <section className="editorial-shell relative overflow-hidden p-5 sm:p-7 xl:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(91,232,255,0.12),transparent_52%),radial-gradient(circle_at_84%_10%,rgba(255,255,255,0.05),transparent_42%)]" />
          <div className="relative z-10">
            <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Explore {NETWORK_CITY}</p>
                <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl lg:text-[2.6rem]">
                  Premium listings, staged like a product launch
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-cyan-50/72">
                  Browse books with stronger presentation, cleaner trust signals, and faster decision-making.
                </p>
                <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex">
                  <span className="rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50">
                    {activeListingsCount} active listings
                  </span>
                  <span className="rounded-full border border-cyan-300/16 bg-[#09111a]/78 px-3 py-1 text-xs font-semibold text-cyan-50/84">
                    {liveBooksCount} live books
                  </span>
                  {!hasLiveListings && (
                    <span className="rounded-full border border-emerald-200/35 bg-emerald-200/18 px-3 py-1 text-xs font-semibold text-emerald-100">
                      Demo showcase mode
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-cyan-50/68 sm:hidden">
                  {activeListingsCount} active listings | {liveBooksCount} books
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="hidden items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50 md:flex">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified community
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRequests && onOpenRequests()}
                  className="rounded-full border border-cyan-300/18 bg-[#09111a]/80 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-[#0d1824]"
                >
                  See requests
                </button>
              </div>
            </div>

            <div className={`${showStageFilters ? 'grid' : 'hidden'} mb-5 gap-2 sm:grid-cols-2`}>
              <select
                value={bookSubjectFilter}
                onChange={(e) => setBookSubjectFilter(e.target.value)}
                className="lux-select text-sm font-medium"
              >
                <option value="all" className="bg-[#08111a]">
                  All subjects
                </option>
                {bookSubjectOptions
                  .filter((option) => option !== 'all')
                  .map((option) => (
                    <option key={option} value={option} className="bg-[#08111a]">
                      {option}
                    </option>
                  ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="lux-select text-sm font-medium"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#08111a]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              ref={stageRef}
              onMouseMove={handleStageMouseMove}
              onMouseLeave={resetStageTilt}
              className="book-stage book-stage--viewport relative hidden overflow-hidden rounded-[2.2rem] border border-cyan-300/24 bg-[linear-gradient(150deg,rgba(92,232,255,0.08),rgba(7,11,18,0.88)_40%,rgba(3,6,10,0.96))] px-4 py-5 md:block sm:px-6 sm:py-6 lg:px-8 lg:py-7"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(92,232,255,0.1),transparent_25%),linear-gradient(180deg,rgba(3,6,10,0.02),rgba(3,6,10,0.08)_38%,rgba(3,6,10,0.18)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[58%] overflow-hidden">
                <div className="book-stage__ghost text-center font-[Sora] text-[3.5rem] font-extrabold uppercase leading-none tracking-[-0.08em] text-white/15 sm:text-[4.6rem] lg:text-[6.4rem]">
                  {featuredGhostWord}
                </div>
              </div>

              <div className="book-stage__content relative z-10 flex flex-col gap-6">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,0.94fr)_minmax(360px,1.02fr)] xl:items-center">
                  <div className="flex max-w-[640px] min-h-[560px] flex-col">
                    <div className="min-h-[136px]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Featured Book</p>
                      {featuredBook ? (
                        <>
                          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-[2.1rem]">
                            {featuredBook.title}
                          </h3>
                          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-cyan-50/76 sm:text-[0.98rem]">
                            {featuredBook.successNote || 'Trusted student listing with premium visibility and neighborhood trust built in.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-[2.1rem]">
                            Book showcases are getting ready
                          </h3>
                          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-cyan-50/76 sm:text-[0.98rem]">
                            The first live book will appear here as a dramatic centerpiece instead of getting buried inside ordinary cards.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {featuredBook && (
                        <>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${featuredStatusMeta.badgeClass}`}>{featuredStatusMeta.label}</span>
                          <span className="rounded-full border border-cyan-300/16 bg-[#09111a]/72 px-3 py-1 text-xs font-semibold text-cyan-50/78">
                            {timeAgo(featuredBook.createdAt)}
                          </span>
                        </>
                      )}
                      <span className="rounded-full border border-cyan-300/16 bg-[#09111a]/72 px-3 py-1 text-xs font-semibold text-cyan-50/78">
                        {featuredLocationLine}
                      </span>
                    </div>

                    <div className="mt-4 min-h-[146px]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/54">Offer Price</p>
                      <div className="mt-2 flex flex-wrap items-end gap-4">
                        <p className="font-display text-3xl font-semibold text-cyan-100 sm:text-4xl lg:text-[3rem]">
                          {featuredBook ? (Number(featuredBook.price) === 0 ? 'Free' : `₹${featuredBook.price}`) : 'Coming Soon'}
                        </p>
                        {featuredMetadata.length > 0 && (
                          <div className="flex flex-wrap gap-2 pb-1">
                            {featuredMetadata.map((chip) => (
                              <span
                                key={`featured-${chip}`}
                                className="rounded-full border border-cyan-300/16 bg-[#09111a]/72 px-3 py-1.5 text-[11px] font-semibold text-cyan-50/82"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {featuredBook && <p className="mt-3 max-w-md text-xs text-cyan-50/64">{featuredTrust}</p>}
                    </div>

                    <div className="book-stage__statband mt-5 grid gap-2 sm:grid-cols-3">
                      <div className="book-stage__stat">
                        <span className="book-stage__stat-label">Seller</span>
                        <strong>{featuredBook ? sellerProfiles[featuredBook.sellerId]?.displayName || featuredBook.sellerName || 'Trusted member' : 'Trusted member'}</strong>
                      </div>
                      <div className="book-stage__stat">
                        <span className="book-stage__stat-label">Handovers</span>
                        <strong>{featuredBook ? sellerStatsMap[featuredBook.sellerId]?.sold || 0 : 0}</strong>
                      </div>
                      <div className="book-stage__stat">
                        <span className="book-stage__stat-label">Condition</span>
                        <strong>{featuredBook?.condition || 'Well-kept'}</strong>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => featuredBook && toggleSaveOffer(featuredBook.id)}
                        disabled={featuredIsSaving}
                        className="book-stage__cta inline-flex min-w-[190px] items-center justify-center gap-2 rounded-[1.05rem] px-5 py-3 text-sm font-bold text-[#1e1606] transition hover:brightness-110"
                      >
                        {featuredIsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className={`h-4 w-4 ${featuredSaved ? 'fill-current' : ''}`} />}
                        {featuredIsSaving ? 'Saving...' : featuredSaved ? 'Offer Saved' : 'Save Offer'}
                      </button>
                      {featuredConnectLink && (
                        <a
                          href={featuredConnectLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-cyan-300/18 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-white/[0.08]"
                        >
                          Connect
                        </a>
                      )}
                      {featuredCanReserve && (
                        <button
                          type="button"
                          onClick={() => openReserveModal(featuredBook)}
                          disabled={featuredReserveSent}
                          className="rounded-full border border-cyan-300/18 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {featuredReserveSent ? 'Requested' : 'Reserve'}
                        </button>
                      )}
                    </div>

                    <div className="mt-auto flex items-center gap-3 pt-5">
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(-1)}
                        disabled={filteredBookNotices.length <= 1}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/18 bg-[#09111a]/70 text-cyan-50 transition hover:border-cyan-300/34 hover:bg-[#0d1824] disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Previous book"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftFeaturedBook(1)}
                        disabled={filteredBookNotices.length <= 1}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/18 bg-[#09111a]/70 text-cyan-50 transition hover:border-cyan-300/34 hover:bg-[#0d1824] disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Next book"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/50">Live books</p>
                        <p className="mt-0.5 text-sm font-semibold text-cyan-50/82">{featuredCountLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex min-h-[260px] items-center justify-center py-1 sm:min-h-[340px] lg:min-h-[420px] xl:min-h-[460px]">
                    <div className="book-hero relative w-full max-w-[420px]">
                      <div className="book-hero__glow absolute inset-x-[-16%] bottom-[16%] top-[18%]" />
                      {[3, 2, 1].map((trail) => (
                        <div key={trail} className={`book-hero__trail book-hero__trail--${trail} absolute inset-0`}>
                          <div className="book-hero__trail-cover h-full w-full rounded-[2rem]" />
                        </div>
                      ))}

                      <div className="book-hero__shadow absolute inset-x-[8%] bottom-2 h-14 rounded-full bg-black/75 blur-[28px]" />
                      <div className="book-hero__core absolute inset-0">
                        <div className="book-hero__object absolute inset-0">
                          <div className="book-hero__bookmark absolute right-[22px] top-[-18px] z-20 h-20 w-10 rounded-b-[1.1rem]" />
                          <div className="book-hero__backplate absolute inset-[14px_18px_6px_26px] rounded-[2rem]" />
                          <div className="book-hero__spine absolute bottom-[8px] left-[-18px] top-[12px] w-[38px] rounded-l-[1.4rem]" />
                          <div className="book-hero__pageblock absolute bottom-[14px] right-[-26px] top-[22px] w-[54px] rounded-r-[1.5rem]" />
                          <div className="book-hero__cover absolute inset-0 overflow-hidden rounded-[2rem] border border-cyan-100/20 bg-[#071019] shadow-[0_42px_90px_-34px_rgba(0,0,0,0.98)]">
                            <div className="book-hero__topedge absolute inset-x-[8%] top-[10px] z-10 h-2 rounded-full" />
                            {featuredBook?.photoUrl ? (
                              <>
                                <img src={featuredBook.photoUrl} alt={featuredBook.title} className="h-full w-full object-cover" />
                                <div className="book-hero__reflection absolute inset-y-0 left-[10%] z-10 w-[26%]" />
                                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.26),transparent_18%,transparent_52%,rgba(0,0,0,0.3)),linear-gradient(180deg,rgba(10,6,2,0.06),rgba(10,6,2,0.68)_88%)]" />
                                <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/36 to-transparent" />
                                <div className="absolute inset-x-4 bottom-4 rounded-[1.1rem] border border-cyan-100/14 bg-black/28 px-4 py-3 backdrop-blur-md">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-50/70">Vidya Share Selection</p>
                                  <p className="mt-1 line-clamp-2 text-base font-semibold text-white">{featuredBook.title}</p>
                                </div>
                              </>
                            ) : (
                              <div className="book-cover-fallback flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_50%_18%,rgba(91,232,255,0.24),transparent_22%),linear-gradient(160deg,#0a1622_0%,#08121c_38%,#050b11_100%)] px-6 py-6 text-cyan-50">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-50/72">Vidya Share Edition</p>
                                  <div className="mt-4 h-px w-20 bg-cyan-300/30" />
                                </div>
                                <div>
                                  <p className="font-display text-3xl font-semibold leading-[1.02] text-white sm:text-[2.6rem]">
                                    {featuredBook ? featuredBook.title : 'Trusted books, staged beautifully'}
                                  </p>
                                  <p className="mt-3 text-sm leading-relaxed text-cyan-50/72">
                                    {featuredBook
                                      ? featuredBook.successNote || 'Student-trusted offer ready for direct handover.'
                                      : 'Your first live listing will turn this into a premium product showcase.'}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/78">
                                  <span>{featuredBook ? featuredLocationLine : `${NETWORK_CITY} network`}</span>
                                  <BookOpen className="h-4 w-4" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {filteredBookNotices.length > 0 && (
              <div className="hide-scrollbar mt-4 hidden gap-3 overflow-x-auto pb-2 md:flex">
                {filteredBookNotices.slice(0, 10).map((book, index) => {
                  const isActive = index === featuredBookIndex;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setFeaturedBookIndex(index)}
                      className={`group min-w-[200px] overflow-hidden rounded-2xl border text-left transition ${
                        isActive
                          ? 'border-cyan-300/42 bg-cyan-300/10 shadow-[0_16px_30px_-18px_rgba(91,232,255,0.34)]'
                          : 'border-cyan-300/14 bg-[#09111a]/78 hover:border-cyan-300/28'
                      }`}
                    >
                      <div className="relative h-24 w-full bg-[#100a04]">
                        {book.photoUrl ? (
                          <img src={book.photoUrl} alt={book.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-cyan-50/65">No cover</div>
                        )}
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-cyan-50">
                          {Number(book.price || 0) === 0 ? 'Free' : `₹${book.price || 0}`}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-1 text-xs font-semibold text-white">{book.title}</p>
                        <p className="mt-1 text-[11px] text-cyan-50/68">
                          {book.subject || book.school || 'Saharanpur listing'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 hidden p-4 sm:p-5 md:block lux-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker">Result Deck</p>
            <h3 className="font-display mt-3 text-2xl font-semibold text-white">Curated offers across {NETWORK_CITY}</h3>
            <p className="mt-2 text-sm text-cyan-50/72">
              {liveBooksCount} offers live right now. {activeFilterCount} filters applied.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-300/20 bg-[#07111a]/80 px-3 py-1 font-semibold text-cyan-50/85">
                {liveBooksCount} books
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-[#07111a]/80 px-3 py-1 font-semibold text-cyan-50/85">
                {recentNotices.length} fresh today
              </span>
              {showSavedOnly && (
                <span className="rounded-full border border-emerald-200/30 bg-emerald-200/15 px-3 py-1 font-semibold text-emerald-100">
                  Showing saved only
                </span>
              )}
            </div>
          </div>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-cyan-300 text-[#041018] shadow-[0_14px_30px_-18px_rgba(91,232,255,0.55)]'
                    : 'border border-cyan-300/18 bg-cyan-300/[0.04] text-cyan-50/82 hover:bg-cyan-300/[0.08]'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
