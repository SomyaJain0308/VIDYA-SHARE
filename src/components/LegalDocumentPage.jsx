import React, { useEffect } from 'react';
import { BrandMark } from './BrandLogo';
import ComplianceFooter from './ComplianceFooter';
import { APP_NAME, MARKETPLACE_DISCLOSURE } from '../config/compliance';
import { LEGAL_DOCUMENTS } from '../content/legalDocuments';

export default function LegalDocumentPage({ path }) {
  const documentConfig = LEGAL_DOCUMENTS[path] || LEGAL_DOCUMENTS['/terms'];

  useEffect(() => {
    document.title = `${documentConfig.title} | ${APP_NAME}`;
  }, [documentConfig.title]);

  return (
    <div className="app-shell app-shell-market overflow-x-hidden">
      <div className="relative z-10 min-h-screen">
        <div className="safe-inline pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-cyan-300/14 bg-[#07111a]/88 px-5 py-4 shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark className="h-11 w-11 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Legal & Trust Center</p>
                <h1 className="mt-2 text-2xl font-semibold text-white">{documentConfig.title}</h1>
              </div>
            </div>
            <a
              href="/"
              className="rounded-full border border-cyan-300/18 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-300/36 hover:bg-white/[0.08]"
            >
              Return to marketplace
            </a>
          </div>
        </div>

        <main className="safe-inline pb-8 pt-6">
          <div className="mx-auto w-full max-w-[1200px] space-y-5">
            <section className="rounded-[2rem] border border-cyan-300/14 bg-[#07111a]/88 p-5 shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/62">Last updated</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                  {documentConfig.lastUpdated}
                </span>
                <span className="rounded-full border border-cyan-300/18 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50/76">
                  Marketplace disclosure
                </span>
              </div>
              <p className="mt-4 max-w-4xl text-sm leading-relaxed text-cyan-50/74">{documentConfig.description}</p>
              <p className="mt-3 max-w-4xl text-sm leading-relaxed text-cyan-50/72">{MARKETPLACE_DISCLOSURE}</p>
            </section>

            {documentConfig.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-[2rem] border border-cyan-300/14 bg-[#07111a]/88 p-5 shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-6"
              >
                <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
                <div className="mt-4 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-cyan-50/76">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <ComplianceFooter />
      </div>
    </div>
  );
}
