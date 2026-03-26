import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, CheckCircle2 } from 'lucide-react';
import { BrandMark } from './BrandLogo';

export default function ShareCardGenerator({ item, onDone }) {
  const cardRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const image = canvas.toDataURL('image/png', 1.0);
      setGeneratedImage(image);
    } catch (error) {
      console.error('Failed to generate share card', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    if (navigator.share) {
      try {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const file = new File([blob], 'vidyashare-item.png', { type: blob.type });

        await navigator.share({
          title: `Available: ${item.title}`,
          text: `Check out this ${item.title}${item.school ? ` for ${item.school}` : ''} on Vidya Share.`,
          files: [file],
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `VidyaShare-${item.title.replace(/\s+/g, '-')}.png`;
      link.click();
    }
  };

  return (
    <div className="flex w-full max-w-[1100px] flex-col items-center">
      <div className="absolute left-[-9999px] top-[-9999px] overflow-hidden">
        <div
          ref={cardRef}
          className="flex h-[1920px] w-[1080px] flex-col font-sans"
          style={{
            background:
              'radial-gradient(circle at 10% 10%, rgba(246,204,102,0.34), transparent 35%), radial-gradient(circle at 90% 7%, rgba(160,119,52,0.26), transparent 26%), linear-gradient(140deg, #06080d 0%, #121926 46%, #1d140d 100%)',
          }}
        >
          <div className="z-10 flex items-center justify-between px-16 pb-10 pt-20">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 overflow-hidden rounded-[2rem]">
                <img src="/icon.svg" alt="Vidya Share" className="h-full w-full object-cover" crossOrigin="anonymous" />
              </div>
              <div>
                <h1 className="font-display text-5xl font-black tracking-tight text-white">Vidya Share</h1>
                <p className="mt-2 text-lg font-semibold uppercase tracking-[0.32em] text-cyan-100/82">Trusted used-book exchange</p>
              </div>
            </div>
            <div className="rounded-full bg-cyan-200 px-6 py-3 text-3xl font-bold text-[#082231]">Verified Member</div>
          </div>

          <div className="z-10 flex flex-1 flex-col justify-center px-16">
            <div className="aspect-square w-full overflow-hidden rounded-[3rem] border-[8px] border-white/65 bg-white shadow-2xl">
              <img
                src={item.img || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'}
                alt={item.title}
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            </div>

            <div className="mt-16 rounded-[3rem] bg-white p-12 shadow-xl">
              <p className="mb-4 text-4xl font-bold uppercase tracking-wide text-[#7a5418]">{item.school || 'Saharanpur Campus Listing'}</p>
              <h2 className="mb-8 text-7xl font-black leading-tight text-slate-900">{item.title}</h2>

              <div className="flex items-center gap-6">
                <span className="rounded-3xl bg-slate-100 px-8 py-4 text-6xl font-black text-slate-900">
                  {item.price === 0 ? 'FREE' : `₹${item.price}`}
                </span>
                {item.savings > 0 && (
                  <span className="rounded-3xl bg-emerald-50 px-8 py-4 text-4xl font-bold text-emerald-600">
                    Saves ₹{item.savings}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="z-10 mt-auto flex items-center justify-between rounded-t-[4rem] bg-[#24180c] px-16 pb-20 pt-10 text-white">
            <div>
              <p className="mb-2 text-5xl font-bold">Want this?</p>
              <p className="text-3xl text-cyan-100">Reply to my status or check the Vidya Share app.</p>
            </div>
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white p-4">
              <span className="text-center text-xl font-bold text-[#2f2108]">
                Scan
                <br />
                App
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="lux-panel w-full rounded-2xl p-5 text-center sm:p-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-200/20">
          <CheckCircle2 className="h-9 w-9 text-emerald-100" />
        </div>
        <div className="mb-4 flex justify-center">
          <BrandMark className="h-12 w-12" />
        </div>
        <h2 className="font-display mb-2 text-2xl font-semibold text-white">Listing published</h2>
        <p className="mb-4 text-sm text-cyan-50/78">Share a polished status card to reach buyers faster.</p>
        <div className="lux-panel-soft mb-6 rounded-2xl p-4 text-left text-xs text-cyan-50/75">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Quick steps</p>
          <p>1. Generate the card.</p>
          <p>2. Share it on WhatsApp or download.</p>
          <p>3. Buyers can reply directly for pickup.</p>
        </div>

        {!generatedImage ? (
          <button
            onClick={generateImage}
            disabled={isGenerating}
            className="btn-primary w-full rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-60"
          >
            {isGenerating ? 'Creating card...' : 'Generate WhatsApp Card'}
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <img src={generatedImage} alt="Preview" className="mx-auto w-48 rounded-xl border border-cyan-300/24 shadow-md" />
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white"
              >
                <Share2 className="h-4 w-4" /> Share Status
              </button>
              <button onClick={onDone} className="rounded-xl bg-white/10 px-5 py-3.5 text-sm font-semibold text-white">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
