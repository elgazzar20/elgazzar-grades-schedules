import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Hash,
  MessageCircle,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import {
  ParsedScoreCard,
  StudentPerformanceSummary,
  TEACHER_PHONE_LOCAL,
  buildStudentWhatsAppUrl,
} from '../utils/grading';
import { StudentRecord } from '../data/mockDatabase';

const TEACHER_AVATAR_URL = '/assets/aistudio/Picsart_26-09-19_10-18-54-766_95668d91.jpg';

interface StudentDashboardProps {
  student: StudentRecord;
  summary: StudentPerformanceSummary;
  onResetSearch: () => void;
}

/**
 * تحميل صورة من مسار محلي لاستخدامها داخل Canvas
 */
function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * رسم صورة بنمط object-cover داخل منطقة محددة في الـ Canvas
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alignTop = false
) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = alignTop ? 0 : (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  summary,
  onResetSearch,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const { overallPercentage, totalEarned, totalMax, parsedCards, badge } = summary;

  // Circular SVG gauge parameters
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, overallPercentage)) / 100) * circumference;

  const gaugeStrokeColor =
    badge.tier === 'legendary'
      ? '#10B981' // Emerald
      : badge.tier === 'distinguished'
        ? '#06B6D4' // Cyan
        : badge.tier === 'rising'
          ? '#38BDF8' // Sky
          : '#F43F5E'; // Rose

  const whatsAppUrl = buildStudentWhatsAppUrl({
    name: student.name,
    grade: student.grade,
    id: student.id,
    percentage: overallPercentage,
  });

  const issueDateFormatted = new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const handlePrintCertificate = () => {
    window.print();
  };

  /**
   * تحميل الشهادة كصورة عالية الدقة (PNG) بتصميم كحلي وسماوي أنيق
   * يضم صورة الأستاذ محمد الجزار واسمه وجميع درجات الطالب بدون أي خطوط صفراء أو تشوه في الخلفية
   */
  const handleDownloadCertificateImage = async () => {
    setIsExportingImage(true);
    try {
      await document.fonts.ready;

      const teacherImg = await loadImageElement(TEACHER_AVATAR_URL);

      const canvas = document.createElement('canvas');
      const width = 1280;
      const rowCount = Math.ceil(parsedCards.length / 2);
      const height = 800 + rowCount * 114;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. خلفية متدرجة فخمة وهادئة (كحلي داكن مع إضاءة سماوية/تيل ناعمة في الأعلى فقط بدون أي تشوه بالأسفل)
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#071124');
      bgGrad.addColorStop(0.5, '#0b1930');
      bgGrad.addColorStop(1, '#060d1b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // إضاءة سماوية خفيفة في أعلى الشهادة
      const topGlow = ctx.createRadialGradient(width / 2, 120, 40, width / 2, 120, 620);
      topGlow.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
      topGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. إطار خارجي سماوي ناعم وأنيق (بدون أي خطوط صفراء)
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(28, 28, width - 56, height - 56, 32);
      ctx.stroke();
      ctx.restore();

      // 3. الهيدر العلوي: صورة الأستاذ محمد الجزار + اسمه ولقبه
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.30)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(56, 56, width - 112, 178, 24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // رسم صورة الأستاذ محمد الجزار في إطار سماوي أنيق على اليمين
      const avatarX = width - 216;
      const avatarY = 75;
      const avatarSize = 140;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 22);
      ctx.closePath();
      ctx.clip();
      if (teacherImg) {
        drawImageCover(ctx, teacherImg, avatarX, avatarY, avatarSize, avatarSize, true);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 22);
      ctx.stroke();
      ctx.restore();

      // نصوص اسم الأستاذ محمد الجزار وعنوان الشهادة بجانب صورته
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';

      ctx.fillStyle = '#34D399';
      ctx.font = '800 19px Cairo, sans-serif';
      ctx.fillText('منصة المتفوقين في الرياضيات — شهادة تقييم مستوى الطالب', avatarX - 26, 108);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 42px Cairo, sans-serif';
      ctx.fillText('مستر محمد الجزار', avatarX - 26, 162);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 20px Cairo, sans-serif';
      ctx.fillText(
        'خبير تدريس مادة الرياضيات للمراحل الابتدائية والإعدادية والثانوية',
        avatarX - 26,
        204
      );

      // شارة التوثيق وتاريخ الإصدار على اليسار
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(84, 86, 220, 118, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6EE7B7';
      ctx.font = '900 19px Cairo, sans-serif';
      ctx.fillText('✓ شهادة معتمدة', 194, 126);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 15px Cairo, sans-serif';
      ctx.fillText(issueDateFormatted, 194, 158);

      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 16px Cairo, sans-serif';
      ctx.fillText(`ت: ${TEACHER_PHONE_LOCAL}`, 194, 186);

      // 4. بطاقة بيانات الطالب والنسبة الكلية
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(56, 256, width - 112, 168, 24);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 18px Cairo, sans-serif';
      ctx.fillText('بيانات الطالب / الطالبة:', width - 86, 298);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 36px Cairo, sans-serif';
      ctx.fillText(student.name, width - 86, 348);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '800 20px Cairo, sans-serif';
      const studentMetaLine = [
        `الصف ${student.grade}`,
        `كود الطالب: #${student.id}`,
        student.group ? student.group : '',
      ]
        .filter(Boolean)
        .join('   •   ');
      ctx.fillText(studentMetaLine, width - 86, 396);

      // مربع النسبة المئوية والتقدير على يسار بطاقة الطالب
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.10)';
      ctx.strokeStyle = gaugeStrokeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(84, 274, 310, 132, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px Cairo, sans-serif';
      ctx.fillText(`${overallPercentage}%`, 239, 324);

      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 19px Cairo, sans-serif';
      ctx.fillText(`التقدير العام: ${badge.gradeLabel}`, 239, 358);

      ctx.fillStyle = '#6EE7B7';
      ctx.font = '800 18px Cairo, sans-serif';
      ctx.fillText(`المجموع الكلي: ${totalEarned} من ${totalMax}`, 239, 390);

      // 5. عنوان جدول الدرجات
      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 22px Cairo, sans-serif';
      ctx.fillText('تفاصيل درجات الاختبارات والتقييمات:', width - 60, 468);

      // 6. بطاقات الدرجات (عمودين)
      const cardWidth = (width - 136) / 2;
      const cardHeight = 94;
      parsedCards.forEach((card, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = col === 0 ? width - 56 - cardWidth : 56;
        const y = 488 + row * 110;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 20px Cairo, sans-serif';
        ctx.fillText(card.cleanTitle, x + cardWidth - 22, y + 38);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 15px Cairo, sans-serif';
        ctx.fillText(`المستوى: ${card.levelLabel}`, x + cardWidth - 22, y + 70);

        ctx.textAlign = 'left';
        ctx.fillStyle = card.isPending
          ? '#94A3B8'
          : card.level === 'excellent'
            ? '#34D399'
            : card.level === 'good'
              ? '#38BDF8'
              : '#FB7185';
        ctx.font = card.isPending ? '800 20px Cairo, sans-serif' : '900 25px Cairo, sans-serif';
        ctx.fillText(card.rawValue, x + 24, y + 44);

        if (!card.isAttendanceOrPercentageOnly && !card.isPending) {
          ctx.fillStyle = '#67E8F9';
          ctx.font = '800 15px Cairo, sans-serif';
          ctx.fillText(`${card.percentage}%`, x + 24, y + 72);
        }
      });

      // 7. صندوق ملاحظة وتوجيه الأستاذ محمد الجزار (يُرسم فقط إذا كانت هناك ملاحظة مسجلة في الشيت)
      const noteY = 502 + rowCount * 110;
      if (student.note) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.30)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(56, noteY, width - 112, 108, 18);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#67E8F9';
        ctx.font = '900 19px Cairo, sans-serif';
        ctx.fillText('ملاحظات:', width - 84, noteY + 38);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 20px Cairo, sans-serif';
        ctx.fillText(`«${student.note}»`, width - 84, noteY + 76);
      }

      // 8. تذييل الشهادة النظيف
      const footerY = student.note ? noteY + 152 : noteY + 44;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 19px Cairo, sans-serif';
      ctx.fillText('إشراف واعتماد: مستر محمد الجزار', width - 60, footerY);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '800 18px Cairo, sans-serif';
      ctx.fillText(`للتواصل واتساب: ${TEACHER_PHONE_LOCAL}`, 60, footerY);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `شهادة-${student.name}-مستر-محمد-الجزار.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExportingImage(false);
    }
  };

  const renderCategoryIcon = (category: ParsedScoreCard['categoryIcon']) => {
    switch (category) {
      case 'algebra':
        return <Calculator className="w-5 h-5 text-cyan-400 shrink-0" />;
      case 'geometry':
        return <Compass className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'exam':
        return <Award className="w-5 h-5 text-cyan-300 shrink-0" />;
      case 'homework':
        return <BookOpen className="w-5 h-5 text-teal-300 shrink-0" />;
      case 'attendance':
        return <CalendarCheck className="w-5 h-5 text-emerald-300 shrink-0" />;
      default:
        return <FileSpreadsheet className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      aria-label="لوحة نتيجة الطالب"
      data-testid="student-dashboard"
      className="space-y-4 text-right"
    >
      {/* شريط التحكم العلوي (بحث جديد · تنزيل الشهادة كصورة · طباعة الشهادة) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/75 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 sm:px-5 no-print">
        <button
          type="button"
          onClick={onResetSearch}
          data-testid="reset-search-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 text-cyan-300" />
          <span>بحث عن طالب آخر</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadCertificateImage}
            disabled={isExportingImage}
            data-testid="download-certificate-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-950 border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 font-black text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-cyan-300" />
            <span>{isExportingImage ? 'جاري تجهيز الشهادة...' : 'تنزيل الشهادة كصورة'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCertificate}
            data-testid="print-certificate-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>طباعة الشهادة</span>
          </button>
        </div>
      </div>

      {/* بطاقة الشهادة المنسقة والنظيفة (بدون أي إطار أصفر وبدون تكرار صورة الخلفية بالأسفل) */}
      <div
        id="printable-certificate"
        className="print-certificate-frame bg-slate-900/85 backdrop-blur-2xl border border-cyan-400/30 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* 1. هيدر الشهادة: صورة الأستاذ محمد الجزار + اسمه ولقبه + شارة الاعتماد */}
        <div className="bg-gradient-to-l from-cyan-500/15 via-teal-500/10 to-slate-950/85 border-b border-white/10 p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-cyan-400/80 ring-4 ring-cyan-400/15 bg-slate-950 p-1 shadow-xl overflow-hidden shrink-0">
              {!avatarError ? (
                <img
                  src={TEACHER_AVATAR_URL}
                  alt="مستر محمد الجزار"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover object-top rounded-xl"
                />
              ) : (
                <User className="w-10 h-10 text-cyan-400 m-auto" />
              )}
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-cyan-300 text-xs font-black">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>منصة المتفوقين في الرياضيات — شهادة تقييم مستوى الطالب</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                مستر محمد الجزار
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-300">
                خبير تدريس مادة الرياضيات للمراحل الابتدائية والإعدادية والثانوية
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-black">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>شهادة معتمدة وموثقة</span>
            </div>
            <div className="text-[11px] text-slate-300 font-bold">
              تاريخ الإصدار: {issueDateFormatted}
            </div>
            <div dir="ltr" className="text-xs font-black text-cyan-300 font-mono-num">
              {TEACHER_PHONE_LOCAL}
            </div>
          </div>
        </div>

        {/* جسم الشهادة الرئيسي */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* 2. بيانات الطالب والنسبة المئوية الكلية */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-950/65 border border-white/10 rounded-2xl p-5 items-center">
            <div className="md:col-span-7 space-y-3 text-center sm:text-right">
              <div className="text-xs font-black text-cyan-300">
                تُمنح هذه الشهادة للطالب / الطالبة:
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {student.name}
              </h3>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1 text-xs font-black">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200">
                  <GraduationCap className="w-4 h-4 text-cyan-300" />
                  <span>الصف {student.grade}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  <span>كود الطالب: {student.id}</span>
                </span>

                {student.group && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-bold">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{student.group}</span>
                  </span>
                )}
              </div>
            </div>

            {/* دائرة النسبة المئوية والتقدير العام */}
            <div className="md:col-span-5 flex items-center justify-center sm:justify-end gap-4 pt-4 md:pt-0 border-t md:border-t-0 md:border-r border-white/10 md:pr-5">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke="rgba(148,163,184,0.18)"
                    strokeWidth="9"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={gaugeStrokeColor}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span
                    data-testid="overall-percentage"
                    dir="ltr"
                    className="text-xl sm:text-2xl font-black text-white font-mono-num"
                  >
                    {overallPercentage}%
                  </span>
                  <span className="text-[10px] font-bold text-cyan-300">النسبة الكلية</span>
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-black">
                  <span>التقدير العام: {badge.gradeLabel}</span>
                </div>
                <p
                  data-testid="student-badge-title"
                  className="text-sm sm:text-base font-black text-white"
                >
                  {badge.title}
                </p>
                <p className="text-xs font-bold text-slate-300">
                  المجموع الكلي:{' '}
                  <span dir="ltr" className="text-emerald-300 font-black font-mono-num">
                    {totalEarned} / {totalMax}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* 3. تفاصيل درجات الاختبارات والتقييمات */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm sm:text-base font-black text-cyan-300 flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>بيان درجات الاختبارات والتقييمات المسجلة</span>
              </h3>
              <span className="text-xs text-slate-300 font-bold">
                عدد التقييمات: {parsedCards.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parsedCards.map((card, idx) => {
                const barColor = card.isPending
                  ? 'bg-slate-700'
                  : card.level === 'excellent'
                    ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                    : card.level === 'good'
                      ? 'bg-gradient-to-r from-cyan-400 to-sky-400'
                      : 'bg-gradient-to-r from-rose-500 to-amber-400';

                const scoreTextColor = card.isPending
                  ? 'text-slate-400'
                  : card.level === 'excellent'
                    ? 'text-emerald-300'
                    : card.level === 'good'
                      ? 'text-cyan-300'
                      : 'text-rose-300';

                return (
                  <div
                    key={`${card.title}-${idx}`}
                    data-testid="score-card"
                    className="bg-slate-950/65 border border-white/10 hover:border-cyan-400/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-900 border border-white/10">
                          {renderCategoryIcon(card.categoryIcon)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white leading-snug">
                            {card.cleanTitle}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-300 inline-flex items-center gap-1 mt-0.5">
                            <CheckCircle2
                              className={`w-3 h-3 ${
                                card.isPending ? 'text-slate-400' : 'text-emerald-400'
                              }`}
                            />
                            <span>المستوى: {card.levelLabel}</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div
                          dir="ltr"
                          className={`text-base sm:text-lg font-black font-mono-num whitespace-nowrap ${scoreTextColor}`}
                        >
                          {card.rawValue}
                        </div>
                        {!card.isAttendanceOrPercentageOnly && !card.isPending && (
                          <div
                            dir="ltr"
                            className="text-[11px] font-bold text-slate-400 font-mono-num whitespace-nowrap"
                          >
                            {card.percentage}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${card.isPending ? 0 : card.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. ملاحظات الشيت (تظهر فقط إن كانت مكتوبة في الشيت) */}
          {student.note && (
            <div
              data-testid="teacher-note"
              className="bg-gradient-to-l from-cyan-500/10 via-teal-500/5 to-slate-950/60 border border-cyan-400/25 p-4 sm:p-5 rounded-2xl space-y-1.5"
            >
              <div className="text-xs sm:text-sm font-black text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>ملاحظات مسجلة في الشيت:</span>
              </div>
              <p className="text-sm sm:text-base text-white font-bold leading-relaxed">
                «{student.note}»
              </p>
            </div>
          )}

          {/* 5. تذييل الشهادة الرسمي النظيف */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>شهادة مستخرجة ومعتمدة من منصة مستر محمد الجزار للرياضيات</span>
            </div>

            <div className="flex items-center gap-4">
              <span dir="ltr" className="text-xs font-black text-cyan-300 font-mono-num">
                {TEACHER_PHONE_LOCAL}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-black text-white">
                إشراف واعتماد: مستر محمد الجزار
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. أزرار التحميل والطباعة والواتساب أسفل الشهادة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 no-print">
        <button
          type="button"
          onClick={handleDownloadCertificateImage}
          disabled={isExportingImage}
          className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className="w-5 h-5 text-cyan-300 shrink-0" />
          <span>{isExportingImage ? 'جاري التحميل...' : 'تنزيل الشهادة كصورة'}</span>
        </button>

        <button
          type="button"
          onClick={handlePrintCertificate}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Printer className="w-5 h-5 stroke-[2.5] shrink-0" />
          <span>طباعة الشهادة (PDF / ورقية)</span>
        </button>

        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="student-whatsapp-link"
          className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-emerald-400/40 hover:border-emerald-400 text-emerald-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
        >
          <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>تواصل مع مستر محمد الجزار</span>
        </a>
      </div>
    </motion.div>
  );
};

