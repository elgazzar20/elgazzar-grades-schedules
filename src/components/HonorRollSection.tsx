import React from 'react';
import { Award, BookOpen, CalendarCheck, GraduationCap, Sparkles } from 'lucide-react';
import { HonorRollData, HonorRollStudent } from '../services/sheetsService';

interface HonorRollSectionProps {
  data: HonorRollData | null;
}

/**
 * أيقونة إكليل الغار مع كأس البطولة بألوان هادئة ومريحة للعين
 */
function LaurelTrophyCrest() {
  return (
    <svg
      viewBox="0 0 120 96"
      className="w-22 h-18 sm:w-26 sm:h-22 mx-auto drop-shadow-[0_6px_16px_rgba(6,182,212,0.25)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="calmGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="calmCupShine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
      </defs>

      {/* النجوم الثلاث العلوية */}
      <path
        d="M60 4L62.2 8.6L67.2 9.3L63.6 12.8L64.5 17.8L60 15.4L55.5 17.8L56.4 12.8L52.8 9.3L57.8 8.6L60 4Z"
        fill="url(#calmCupShine)"
      />
      <path
        d="M39 10L40.6 13.3L44.2 13.8L41.6 16.3L42.2 19.9L39 18.2L35.8 19.9L36.4 16.3L33.8 13.8L37.4 13.3L39 10Z"
        fill="url(#calmGoldGrad)"
        opacity="0.85"
      />
      <path
        d="M81 10L82.6 13.3L86.2 13.8L83.6 16.3L84.2 19.9L81 18.2L77.8 19.9L78.4 16.3L75.8 13.8L79.4 13.3L81 10Z"
        fill="url(#calmGoldGrad)"
        opacity="0.85"
      />

      {/* قوس إكليل الغار الأيسر */}
      <path
        d="M52 84C30 80 16 62 18 36C19 26 24 18 29 14"
        stroke="url(#calmGoldGrad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <ellipse cx="21" cy="30" rx="3" ry="6.2" transform="rotate(-25 21 30)" fill="url(#calmGoldGrad)" />
      <ellipse cx="19" cy="43" rx="3" ry="6.5" transform="rotate(-12 19 43)" fill="url(#calmGoldGrad)" />
      <ellipse cx="22" cy="56" rx="3" ry="6.5" transform="rotate(8 22 56)" fill="url(#calmGoldGrad)" />
      <ellipse cx="29" cy="68" rx="3" ry="6.5" transform="rotate(28 29 68)" fill="url(#calmGoldGrad)" />
      <ellipse cx="40" cy="77" rx="3" ry="6.2" transform="rotate(48 40 77)" fill="url(#calmGoldGrad)" />

      {/* قوس إكليل الغار الأيمن */}
      <path
        d="M68 84C90 80 104 62 102 36C101 26 96 18 91 14"
        stroke="url(#calmGoldGrad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <ellipse cx="99" cy="30" rx="3" ry="6.2" transform="rotate(25 99 30)" fill="url(#calmGoldGrad)" />
      <ellipse cx="101" cy="43" rx="3" ry="6.5" transform="rotate(12 101 43)" fill="url(#calmGoldGrad)" />
      <ellipse cx="98" cy="56" rx="3" ry="6.5" transform="rotate(-8 98 56)" fill="url(#calmGoldGrad)" />
      <ellipse cx="91" cy="68" rx="3" ry="6.5" transform="rotate(-28 91 68)" fill="url(#calmGoldGrad)" />
      <ellipse cx="80" cy="77" rx="3" ry="6.2" transform="rotate(-48 80 77)" fill="url(#calmGoldGrad)" />

      {/* مقابض الكأس */}
      <path
        d="M43 32H36C34 32 33 34 33 37C33 43 38 48 45 49"
        stroke="url(#calmCupShine)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M77 32H84C86 32 87 34 87 37C87 43 82 48 75 49"
        stroke="url(#calmCupShine)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* جسم الكأس */}
      <path
        d="M42 26H78V40C78 51 70 59 60 59C50 59 42 51 42 40V26Z"
        fill="url(#calmCupShine)"
        stroke="#FDE68A"
        strokeWidth="1.2"
      />
      {/* عنق وقاعدة الكأس */}
      <rect x="56" y="59" width="8" height="11" rx="2" fill="url(#calmCupShine)" />
      <path d="M47 70H73L76 77H44L47 70Z" fill="url(#calmCupShine)" />
      <rect x="42" y="77" width="36" height="4" rx="2" fill="#FDE68A" opacity="0.85" />

      {/* نجمة بوسط الكأس */}
      <path
        d="M60 33L62.1 37.4L67 38.1L63.5 41.5L64.3 46.3L60 44L55.7 46.3L56.5 41.5L53 38.1L57.9 37.4L60 33Z"
        fill="#451A03"
      />
    </svg>
  );
}

/**
 * وسام شرف بألوان هادئة ومتناسقة مع رقم المركز
 */
function RankMedallion({ rank }: { rank: number }) {
  const palette =
    rank === 1
      ? {
          outer: 'from-amber-300/90 via-amber-400/85 to-amber-600/90',
          inner: 'bg-slate-950 text-amber-200 border-amber-300/60',
          ring: 'ring-amber-400/20',
          ribbon: 'from-amber-500/80 to-amber-700/80',
        }
      : rank === 2
        ? {
            outer: 'from-slate-200 via-cyan-200 to-slate-400',
            inner: 'bg-slate-950 text-cyan-200 border-cyan-300/60',
            ring: 'ring-cyan-400/20',
            ribbon: 'from-cyan-500/80 to-slate-600',
          }
        : rank === 3
          ? {
              outer: 'from-teal-300 via-emerald-400 to-teal-600',
              inner: 'bg-slate-950 text-emerald-200 border-emerald-300/60',
              ring: 'ring-emerald-400/20',
              ribbon: 'from-teal-600 to-emerald-700',
            }
          : {
              outer: 'from-cyan-400/80 via-sky-400/80 to-blue-500/80',
              inner: 'bg-slate-950 text-cyan-200 border-cyan-400/50',
              ring: 'ring-cyan-400/15',
              ribbon: 'from-cyan-600 to-slate-700',
            };

  return (
    <div className="relative flex flex-col items-center shrink-0">
      <div
        className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full p-1 bg-gradient-to-br ${palette.outer} ring-4 ${palette.ring} shadow-md flex items-center justify-center relative z-10`}
      >
        <div
          className={`w-full h-full rounded-full border border-dashed ${palette.inner} flex flex-col items-center justify-center`}
        >
          <span className="text-[9px] font-bold opacity-85 leading-none">المركز</span>
          <span className="text-base sm:text-lg font-black font-mono-num leading-tight">
            {rank}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 -mt-1.5 z-0">
        <div
          className={`w-2.5 h-3.5 bg-gradient-to-b ${palette.ribbon} rounded-b-sm rotate-12`}
        />
        <div
          className={`w-2.5 h-3.5 bg-gradient-to-b ${palette.ribbon} rounded-b-sm -rotate-12`}
        />
      </div>
    </div>
  );
}

function getArabicOrdinalLabel(rank: number): string {
  switch (rank) {
    case 1:
      return 'المركز الأول';
    case 2:
      return 'المركز الثاني';
    case 3:
      return 'المركز الثالث';
    case 4:
      return 'المركز الرابع';
    case 5:
      return 'المركز الخامس';
    case 6:
      return 'المركز السادس';
    case 7:
      return 'المركز السابع';
    case 8:
      return 'المركز الثامن';
    case 9:
      return 'المركز التاسع';
    case 10:
      return 'المركز العاشر';
    default:
      return `المركز #${rank}`;
  }
}

export const HonorRollSection: React.FC<HonorRollSectionProps> = ({ data }) => {
  const students = data?.students ?? [];

  if (!data || students.length === 0) {
    return null;
  }

  const firstPlace: HonorRollStudent = students[0];
  const otherWinners: HonorRollStudent[] = students.slice(1);

  return (
    <section
      aria-label="لوحة الشرف للمتفوقين"
      className="relative overflow-hidden rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-cyan-400/35 shadow-2xl p-4 sm:p-7 space-y-6 no-print"
    >
      {/* إطار داخلي ناعم وهادئ جداً بدون أي لون أصفر فاقع */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2.5 sm:inset-3 rounded-2xl border border-white/8"
      />

      {/* إضاءة سماوية هادئة في قمة اللوحة */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[460px] h-52 rounded-full bg-cyan-500/12 blur-3xl"
      />

      {/* 1. الشعار العلوي وعنوان لوحة الشرف */}
      <div className="relative z-10 text-center space-y-2.5 pt-1">
        <LaurelTrophyCrest />

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-cyan-500/12 border border-cyan-400/30">
            <span className="text-cyan-300 text-xs font-black tracking-wide">
              ★ قائمة الشرف والتفوق في الرياضيات ★
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            لوحة الشرف للمتفوقين
          </h2>

          <div className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-950/85 border border-white/10 text-emerald-300 text-xs sm:text-sm font-black">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>تُحدّث كل أسبوع — خليك متفوق عشان تكون فيهم</span>
          </div>
        </div>
      </div>

      {/* 2. درع كأس المركز الأول (بتحديد هادئ وأنيق بدون أصفر فاقع) */}
      {firstPlace && (
        <div className="relative z-10 pt-2">
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950 border border-cyan-400/40 p-4 sm:p-6 shadow-xl">
            {/* شريطة كأس المركز الأول العلوية بدرجة هادئة ومريحة */}
            <div className="flex justify-center -mt-7 sm:-mt-8 mb-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-slate-900 border border-amber-300/45 text-amber-200 text-xs sm:text-sm font-black shadow-md">
                <span>🏆</span>
                <span>كأس المركز الأول · متصدر الأوائل</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 min-w-0">
                <RankMedallion rank={1} />

                <div className="space-y-1.5 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
                    {firstPlace.studentName}
                  </h3>

                  {firstPlace.grade && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-black">
                      <GraduationCap className="w-4 h-4 text-cyan-300 shrink-0" />
                      <span>الصف {firstPlace.grade}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ختم المعدل العام الهادئ */}
              <div className="px-5 py-2.5 rounded-2xl bg-emerald-500/12 border border-emerald-400/40 text-center shrink-0">
                <div className="text-[11px] font-black text-emerald-200">المعدل العام</div>
                <div
                  dir="ltr"
                  className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono-num leading-tight"
                >
                  {firstPlace.overallRate || firstPlace.examRate || '100%'}
                </div>
              </div>
            </div>

            {/* تفاصيل الدرجات الثلاث داخل درع المركز الأول */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-3.5 border-t border-white/10">
              <div className="rounded-xl bg-slate-900/90 border border-white/10 px-2.5 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold text-slate-300">
                  <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>الامتحان</span>
                </div>
                <div
                  dir="ltr"
                  className="text-xs sm:text-sm font-black text-white font-mono-num mt-0.5"
                >
                  {firstPlace.examRate || '—'}
                </div>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-white/10 px-2.5 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold text-slate-300">
                  <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>الواجب</span>
                </div>
                <div
                  dir="ltr"
                  className="text-xs sm:text-sm font-black text-white font-mono-num mt-0.5"
                >
                  {firstPlace.homeworkRate || '—'}
                </div>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-white/10 px-2.5 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold text-slate-300">
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>الحضور</span>
                </div>
                <div
                  dir="ltr"
                  className="text-xs sm:text-sm font-black text-emerald-300 font-mono-num mt-0.5"
                >
                  {firstPlace.attendanceRate || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. دروع أوسمة الشرف لبقية الأوائل (بتحديد كحلي وسماوي هادئ ومريح للعين) */}
      {otherWinners.length > 0 && (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {otherWinners.map((student) => {
            const isSecond = student.rank === 2;
            const isThird = student.rank === 3;

            return (
              <div
                key={`${student.rank}_${student.studentName}_${student.grade}`}
                className="rounded-2xl border border-white/12 hover:border-cyan-400/35 bg-slate-950/85 p-4 flex flex-col justify-between gap-3.5 shadow-lg transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <RankMedallion rank={student.rank} />

                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-cyan-400/25 bg-cyan-500/10 text-cyan-200 text-[10px] font-black">
                        <span>{isSecond ? '🥈' : isThird ? '🥉' : '🎖️'}</span>
                        <span>وسام {getArabicOrdinalLabel(student.rank)}</span>
                      </span>

                      <h3 className="text-base sm:text-lg font-black text-white break-words leading-snug">
                        {student.studentName}
                      </h3>

                      {student.grade && (
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-300">
                          <GraduationCap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>الصف {student.grade}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ختم النسبة المئوية الهادئ */}
                  <div className="px-3 py-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 text-center shrink-0">
                    <div className="text-[10px] font-bold opacity-85">المعدل</div>
                    <div
                      dir="ltr"
                      className="text-base sm:text-lg font-black font-mono-num leading-tight"
                    >
                      {student.overallRate || student.examRate || '—'}
                    </div>
                  </div>
                </div>

                {/* شريط النسب الثلاث المختصر */}
                <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-white/10 text-center">
                  <div className="rounded-lg bg-slate-900/80 border border-white/8 py-1 px-1.5">
                    <div className="text-[10px] font-bold text-slate-400">الامتحان</div>
                    <div
                      dir="ltr"
                      className="text-xs font-black text-white font-mono-num"
                    >
                      {student.examRate || '—'}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-white/8 py-1 px-1.5">
                    <div className="text-[10px] font-bold text-slate-400">الواجب</div>
                    <div
                      dir="ltr"
                      className="text-xs font-black text-white font-mono-num"
                    >
                      {student.homeworkRate || '—'}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-white/8 py-1 px-1.5">
                    <div className="text-[10px] font-bold text-slate-400">الحضور</div>
                    <div
                      dir="ltr"
                      className="text-xs font-black text-emerald-300 font-mono-num"
                    >
                      {student.attendanceRate || '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
