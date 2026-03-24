import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { motion } from 'framer-motion';
import { Share2, CheckCircle2 } from 'lucide-react';

export default function ShareCardGenerator({ item, onDone }) {
  const cardRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  const generateImage = async () => {
    setIsGenerating(true);
    try {
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
          text: `Check out this ${item.title} for ${item.school} on Vidya Share.`,
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
    <div className="flex w-full flex-col items-center">
      <div className="absolute left-[-9999px] top-[-9999px] overflow-hidden">
        <div
          ref={cardRef}
          className="flex h-[1920px] w-[1080px] flex-col font-sans"
          style={{
            background:
              'radial-gradient(circle at 10% 10%, rgba(122,232,255,0.35), transparent 35%), radial-gradient(circle at 90% 7%, rgba(255,214,155,0.4), transparent 26%), linear-gradient(140deg, #071122 0%, #0e2d57 46%, #0f3769 100%)',
          }}
        >
          <div className="z-10 flex items-center justify-between px-16 pb-10 pt-20">
            <h1 className="text-5xl font-black tracking-tight text-white">
              Vidya<span className="text-cyan-200">Share</span>
            </h1>
            <div className="rounded-full bg-emerald-200 px-6 py-3 text-3xl font-bold text-[#053326]">Verified Parent</div>
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
              <p className="mb-4 text-4xl font-bold uppercase tracking-wide text-[#145aa1]">{item.school}</p>
              <h2 className="mb-8 text-7xl font-black leading-tight text-slate-900">{item.title}</h2>

              <div className="flex items-center gap-6">
                <span className="rounded-3xl bg-slate-100 px-8 py-4 text-6xl font-black text-slate-900">
                  {item.price === 0 ? 'FREE' : `Rs ${item.price}`}
                </span>
                {item.savings > 0 && (
                  <span className="rounded-3xl bg-emerald-50 px-8 py-4 text-4xl font-bold text-emerald-600">
                    Saves Rs {item.savings}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="z-10 mt-auto flex items-center justify-between rounded-t-[4rem] bg-[#0b2c55] px-16 pb-20 pt-10 text-white">
            <div>
              <p className="mb-2 text-5xl font-bold">Want this?</p>
              <p className="text-3xl text-cyan-100">Reply to my status or check the Vidya Share app.</p>
            </div>
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white p-4">
              <span className="text-center text-xl font-bold text-[#0b2c55]">
                Scan
                <br />
                App
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-cyan-100/20 bg-slate-900/30 p-5 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-200/20">
          <CheckCircle2 className="h-9 w-9 text-emerald-100" />
        </div>
        <h2 className="font-display mb-2 text-2xl font-semibold text-white">Listing published</h2>
        <p className="mb-6 text-sm text-slate-100/78">Share a status card to reach buyers faster.</p>

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
            <img src={generatedImage} alt="Preview" className="mx-auto w-48 rounded-xl border border-cyan-100/30 shadow-md" />
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white"
              >
                <Share2 className="h-4 w-4" /> Share Status
              </button>
              <button onClick={onDone} className="rounded-xl bg-slate-100/14 px-5 py-3.5 text-sm font-semibold text-white">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
