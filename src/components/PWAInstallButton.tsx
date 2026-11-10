import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const APP_ICON = '/assets/aistudio/android-chrome-192x192__1__224aa85a.png';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios'>('android');

  const handleInstallClick = async () => {
    // دائماً يبدأ بتبويب الأندرويد أولاً
    setActiveGuideTab('android');

    if (isInstallable) {
      const result = await promptInstall();
      if (result === 'accepted') {
        return;
      }
    }

    setShowGuideModal(true);
  };

  const modalContent = showGuideModal ? (
    <div
      dir="rtl"
      onClick={() => setShowGuideModal(false)}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md no-print animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border-2 border-cyan-400/50 rounded-3xl p-5 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.85)] space-y-4 text-right font-['Cairo',sans-serif] text-white"
      >
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={() => setShowGuideModal(false)}
          aria-label="إغلاق"
          className="absolute top-4 left-4 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-white/15 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* رأس النافذة مع أيقونة التطبيق */}
        <div className="flex items-center gap-3 pl-8">
          <img
            src={APP_ICON}
            alt="مستر محمد الجزار"
            className="w-12 h-12 rounded-2xl border-2 border-cyan-400/70 bg-slate-950 p-0.5 object-cover shadow-md shrink-0"
          />
          <div>
            <h3 id="pwa-modal-title" className="text-base font-black text-white">
              تثبيت تطبيق مستر محمد الجزار
            </h3>
            <p className="text-xs font-bold text-cyan-300">
              يفتح مباشرة من الشاشة الرئيسية للهاتف
            </p>
          </div>
        </div>

        {/* التبديل بين أندرويد (الأول دائماً) وآيفون */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveGuideTab('android')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeGuideTab === 'android'
                ? 'bg-gradient-to-l from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>أندرويد (Android)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('ios')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeGuideTab === 'ios'
                ? 'bg-gradient-to-l from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>آيفون (iPhone)</span>
          </button>
        </div>

        {/* محتوى الخطوات */}
        {activeGuideTab === 'android' ? (
          <div className="space-y-3 bg-slate-950/90 border border-cyan-400/20 rounded-2xl p-4">
            {isInstallable && (
              <button
                type="button"
                onClick={async () => {
                  const res = await promptInstall();
                  if (res === 'accepted') setShowGuideModal(false);
                }}
                className="w-full py-2.5 px-4 mb-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تثبيت مباشر الآن على الهاتف</span>
              </button>
            )}

            <div className="text-xs font-black text-cyan-300">
              خطوات التثبيت على أندرويد (متصفح Chrome):
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اضغط على الثلاث نقاط <MoreVertical className="w-4 h-4 inline text-cyan-300 mx-0.5" /> أعلى يسار متصفح Chrome.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اختر <span className="text-cyan-300 font-black">«تثبيت التطبيق»</span> أو <span className="text-cyan-300 font-black">«الإضافة إلى الشاشة الرئيسية»</span>.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اضغط <span className="text-emerald-300 font-black">تثبيت</span> ليظهر التطبيق على شاشة هاتفك فوراً.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-slate-950/90 border border-cyan-400/20 rounded-2xl p-4">
            <div className="text-xs font-black text-cyan-300">
              خطوات التثبيت على آيفون (متصفح Safari):
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اضغط على زر المشاركة <Share className="w-4 h-4 inline text-cyan-300 mx-0.5" /> في أسفل متصفح Safari.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اختر <PlusSquare className="w-4 h-4 inline text-cyan-300 mx-0.5" /> <span className="text-cyan-300 font-black">«إضافة إلى الشاشة الرئيسية»</span>.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-200 leading-relaxed">
                اضغط <span className="text-emerald-300 font-black">إضافة (Add)</span> في أعلى الشاشة.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowGuideModal(false)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-md cursor-pointer transition-all"
        >
          حسناً
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={handleInstallClick}
        className="w-full sm:w-auto min-h-[50px] px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-cyan-400/45 hover:border-cyan-400 transition-all cursor-pointer group flex items-center justify-center sm:justify-start gap-2 shrink-0"
      >
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="text-right min-w-0">
          <div className="text-[10px] font-bold text-cyan-300 leading-tight whitespace-nowrap">
            تطبيق الهاتف
          </div>
          <div className="text-xs sm:text-sm font-black text-white leading-tight mt-0.5 whitespace-nowrap">
            تثبيت التطبيق
          </div>
        </div>
      </button>

      {typeof document !== 'undefined' && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
};
