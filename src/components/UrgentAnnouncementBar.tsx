import React, { useEffect, useState } from 'react';
import { BellRing, Calendar, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { UrgentAnnouncementItem } from '../services/sheetsService';

interface UrgentAnnouncementBarProps {
  announcements: UrgentAnnouncementItem[];
}

export const UrgentAnnouncementBar: React.FC<UrgentAnnouncementBarProps> = ({
  announcements,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const safeIndex =
    announcements.length > 0 ? Math.min(activeIndex, announcements.length - 1) : 0;

  useEffect(() => {
    if (announcements.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % announcements.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [announcements.length, isPaused]);

  if (!announcements || announcements.length === 0) {
    return null;
  }

  const current = announcements[safeIndex];
  if (!current || !current.text) {
    return null;
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % announcements.length);
  };

  return (
    <div
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className="relative z-40 w-full bg-gradient-to-l from-amber-950/95 via-slate-950/95 to-amber-950/95 border-b border-amber-400/40 shadow-[0_6px_24px_rgba(245,158,11,0.15)] no-print"
    >
      {/* خط مضيء علوي يبرز الشريط العاجل */}
      <div className="h-0.5 w-full bg-gradient-to-l from-amber-400 via-yellow-300 to-amber-500" />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        {/* الجزء الأيمن: شارة التنبيه العاجل + الصف المستهدف + نص الإعلان */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* الصف العلوي في الموبايل: شارة عاجل + الصف المستهدف + التاريخ */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-l from-amber-500 to-yellow-400 text-slate-950 text-[11px] sm:text-xs font-black shadow-sm shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-600 opacity-85" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
              </span>
              <BellRing className="w-3.5 h-3.5 text-slate-950 shrink-0" />
              <span>تنبيه عاجل</span>
            </span>

            {current.targetGrade && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-200 text-[11px] font-black shrink-0">
                <GraduationCap className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{current.targetGrade}</span>
              </span>
            )}

            {current.date && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[10px] sm:text-[11px] font-bold font-mono-num shrink-0">
                <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                <span dir="ltr">{current.date}</span>
              </span>
            )}
          </div>

          {/* نص الإعلان العاجل كامل وواضح بالكامل على الهاتف والكمبيوتر */}
          <p className="text-xs sm:text-sm font-black text-amber-100 leading-relaxed break-words">
            {current.text}
          </p>
        </div>

        {/* أزرار التنقل في حال وجود أكثر من إعلان مفعل في الشيت */}
        {announcements.length > 1 && (
          <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="الإعلان السابق"
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-amber-200 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-black text-amber-300/90 font-mono-num px-1">
              {safeIndex + 1}/{announcements.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="الإعلان التالي"
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-amber-200 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
