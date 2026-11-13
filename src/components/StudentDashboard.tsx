import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Download,
  FileSpreadsheet,
  Flame,
  Gift,
  GraduationCap,
  Hash,
  MessageCircle,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react';
import {
  ParsedScoreCard,
  StudentPerformanceSummary,
  TEACHER_PHONE_LOCAL,
  buildStudentWhatsAppUrl,
} from '../utils/grading';
import { StudentRecord } from '../data/mockDatabase';
import {
  ACADEMIC_MONTHS_ORDER,
  ARABIC_MONTH_NAMES,
  StudentAttendanceData,
  formatArabicSessionCount,
  subscribeToRealtimeStudentAttendance,
  subscribeToRealtimeStudentPayment,
} from '../services/sheetsService';
import {
  PaymentStatusTone,
  StudentPaymentSummary,
  applyCalendarDeadlineToPaymentSummary,
} from '../utils/payment';

const TEACHER_AVATAR_URL = '/assets/aistudio/Picsart_26-09-19_10-18-54-766_95668d91.jpg';

export type StudentPortalView = 'choice' | 'grades' | 'attendance';
type AttendanceSessionFilter = 'all' | 'present' | 'absent' | 'upcoming';

interface StudentDashboardProps {
  student: StudentRecord;
  summary: StudentPerformanceSummary;
  onResetSearch: () => void;
  hideStudentCode?: boolean;
  honorRank?: number | null;
  backButtonLabel?: string;
  activeView?: StudentPortalView;
  onViewChange?: (view: StudentPortalView) => void;
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
  hideStudentCode = false,
  honorRank = null,
  backButtonLabel,
  activeView: controlledView,
  onViewChange,
}) => {
  const [internalTab, setInternalTab] = useState<StudentPortalView>('choice');
  const activeTab: StudentPortalView = controlledView ?? internalTab;

  const [avatarError, setAvatarError] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<StudentPaymentSummary | null>(null);
  const [isPaymentLoaded, setIsPaymentLoaded] = useState<boolean>(false);
  const [sessionFilter, setSessionFilter] = useState<AttendanceSessionFilter>('all');
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState<boolean>(false);
  const [highlightedSessionIndex, setHighlightedSessionIndex] = useState<number | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth() + 1;
    return [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].includes(m) ? m : 11;
  });

  useEffect(() => {
    if (!isMonthMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMonthMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMonthMenuOpen]);

  const handleSelectMonth = (monthNumber: number) => {
    setSelectedMonth(monthNumber);
    setSessionFilter('all');
    setHighlightedSessionIndex(null);
    setIsMonthMenuOpen(false);
  };

  const handleStepMonth = (direction: -1 | 1) => {
    const monthsList = attendanceData?.availableMonths || ACADEMIC_MONTHS_ORDER;
    const currentIdx = monthsList.indexOf(selectedMonth);
    if (currentIdx === -1) return;
    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < monthsList.length) {
      handleSelectMonth(monthsList[nextIdx]);
    }
  };

  const navigateSubView = (nextView: StudentPortalView) => {
    setIsMonthMenuOpen(false);
    if (onViewChange) {
      onViewChange(nextView);
    } else {
      setInternalTab(nextView);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // الاشتراك اللحظي في سجل حضور وغياب الطالب من "أرشيف الحضور" و"قاعدة بيانات الحضور"
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeStudentAttendance(student, (liveAttendance) => {
      setAttendanceData(liveAttendance);
    });
    return () => unsubscribe();
  }, [student.id, student.grade, student.rawGroup, student.group]);

  // الاشتراك اللحظي في حالة الدفع الخاصة بالطالب مع تحديث تلقائي عند تغير اليوم أو الشهر
  useEffect(() => {
    setIsPaymentLoaded(false);
    const unsubscribe = subscribeToRealtimeStudentPayment(
      student.grade,
      student.id,
      (livePayment, loaded) => {
        setPaymentSummary(livePayment);
        if (loaded) setIsPaymentLoaded(true);
      }
    );

    const calendarTimer = window.setInterval(() => {
      setPaymentSummary((prev) =>
        prev ? applyCalendarDeadlineToPaymentSummary(prev, new Date()) : prev
      );
    }, 30000);

    return () => {
      unsubscribe();
      window.clearInterval(calendarTimer);
    };
  }, [student.id, student.grade]);

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

  const handlePrintDocument = () => {
    window.print();
  };

  const currentMonthRecord = attendanceData?.months?.[selectedMonth] || null;
  const filteredSessions = currentMonthRecord
    ? currentMonthRecord.sessions.filter((sess) => {
        if (sessionFilter === 'all') return true;
        if (sessionFilter === 'present') {
          return sess.status === 'present' || sess.status === 'excused' || sess.status === 'late';
        }
        if (sessionFilter === 'absent') return sess.status === 'absent';
        return sess.status === 'upcoming';
      })
    : [];
  const missedSessionsInMonth = currentMonthRecord
    ? currentMonthRecord.sessions.filter((sess) => sess.status === 'absent')
    : [];

  /**
   * تحميل الشهادة كصورة عالية الدقة (PNG) بتصميم كحلي وسماوي هادئ
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

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#071124');
      bgGrad.addColorStop(0.5, '#0b1930');
      bgGrad.addColorStop(1, '#060d1b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const topGlow = ctx.createRadialGradient(width / 2, 120, 40, width / 2, 120, 620);
      topGlow.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
      topGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.40)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(28, 28, width - 56, height - 56, 32);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(56, 56, width - 112, 178, 24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

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

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.40)';
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
        honorRank ? `🏆 المركز #${honorRank} في لوحة الشرف` : '',
        !hideStudentCode && student.id ? `كود الطالب: #${student.id}` : '',
        student.group ? student.group : '',
      ]
        .filter(Boolean)
        .join('   •   ');
      ctx.fillText(studentMetaLine, width - 86, 396);

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

      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 22px Cairo, sans-serif';
      ctx.fillText('تفاصيل درجات الاختبارات والتقييمات:', width - 60, 468);

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
        ctx.fillText(card.cleanTitle, x + cardWidth - 22, y + 36);

        if (card.isTextValue) {
          ctx.fillStyle = '#67E8F9';
          ctx.font = '800 16px Cairo, sans-serif';
          const shortText =
            card.rawValue.length > 36 ? `${card.rawValue.slice(0, 36)}...` : card.rawValue;
          ctx.fillText(shortText, x + cardWidth - 22, y + 70);
        } else {
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
          ctx.font = card.isPending ? '800 20px Cairo, sans-serif' : '900 24px Cairo, sans-serif';
          ctx.fillText(card.rawValue, x + 24, y + 44);

          if (!card.isAttendanceOrPercentageOnly && !card.isPending) {
            ctx.fillStyle = '#67E8F9';
            ctx.font = '800 15px Cairo, sans-serif';
            ctx.fillText(`${card.percentage}%`, x + 24, y + 72);
          }
        }
      });

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

  /**
   * تحميل بيان سجل الحضور الشهري كصورة عالية الدقة (PNG)
   */
  const handleDownloadAttendanceImage = async () => {
    if (!currentMonthRecord) return;
    setIsExportingImage(true);
    try {
      await document.fonts.ready;
      const teacherImg = await loadImageElement(TEACHER_AVATAR_URL);

      const canvas = document.createElement('canvas');
      const width = 1280;
      const rowCount = Math.ceil(currentMonthRecord.sessions.length / 4);
      const height = 660 + rowCount * 135;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#071124');
      bgGrad.addColorStop(0.5, '#0b1930');
      bgGrad.addColorStop(1, '#060d1b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.38)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(28, 28, width - 56, height - 56, 32);
      ctx.stroke();
      ctx.restore();

      // الهيدر العلوي
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(56, 56, width - 112, 165, 24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const avatarX = width - 208;
      const avatarY = 72;
      const avatarSize = 132;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 20);
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
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 20);
      ctx.stroke();
      ctx.restore();

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';

      ctx.fillStyle = '#34D399';
      ctx.font = '800 19px Cairo, sans-serif';
      ctx.fillText(
        `منصة مستر محمد الجزار — بيان حضور وغياب الطالب (${currentMonthRecord.monthDisplayTitle})`,
        avatarX - 24,
        106
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px Cairo, sans-serif';
      ctx.fillText(student.name, avatarX - 24, 156);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 19px Cairo, sans-serif';
      const meta = [
        `الصف ${student.grade}`,
        !hideStudentCode && student.id ? `كود الطالب: #${student.id}` : '',
        attendanceData?.scheduleDaysLabel ? `أيام الحصص: ${attendanceData.scheduleDaysLabel}` : '',
      ]
        .filter(Boolean)
        .join('   •   ');
      ctx.fillText(meta, avatarX - 24, 194);

      // ملخص إحصائيات حضور الشهر
      ctx.fillStyle = 'rgba(15, 23, 42, 0.80)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(56, 244, width - 112, 110, 20);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      const colW = (width - 112) / 4;

      const stats = [
        {
          label: 'الشهر الدراسي',
          val: currentMonthRecord.monthDisplayTitle,
          color: '#67E8F9',
        },
        {
          label: 'مرات الحضور',
          val: `${currentMonthRecord.presentCount} حصص`,
          color: '#34D399',
        },
        {
          label: 'مرات الغياب',
          val: `${currentMonthRecord.absentCount} حصص`,
          color: currentMonthRecord.absentCount > 0 ? '#FB7185' : '#94A3B8',
        },
        {
          label: 'نسبة حضور الشهر',
          val: `${currentMonthRecord.attendancePercentage}%`,
          color: '#38BDF8',
        },
      ];

      stats.forEach((st, i) => {
        const cx = width - 56 - colW * i - colW / 2;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 16px Cairo, sans-serif';
        ctx.fillText(st.label, cx, 284);

        ctx.fillStyle = st.color;
        ctx.font = '900 24px Cairo, sans-serif';
        ctx.fillText(st.val, cx, 326);
      });

      // عنوان مربعات الحصص
      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 21px Cairo, sans-serif';
      ctx.fillText(
        `تفاصيل سجل حضور وغياب الحصص — ${currentMonthRecord.monthDisplayTitle}:`,
        width - 60,
        398
      );

      // رسم المربعات الصغيرة (4 في الصف)
      const gap = 16;
      const boxW = (width - 112 - gap * 3) / 4;
      const boxH = 112;

      currentMonthRecord.sessions.forEach((sess, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const x = width - 56 - boxW - col * (boxW + gap);
        const y = 420 + row * (boxH + 18);

        ctx.fillStyle =
          sess.status === 'present'
            ? 'rgba(6, 78, 59, 0.35)'
            : sess.status === 'absent'
              ? 'rgba(136, 19, 55, 0.38)'
              : 'rgba(15, 23, 42, 0.75)';
        ctx.strokeStyle =
          sess.status === 'present'
            ? 'rgba(52, 211, 153, 0.45)'
            : sess.status === 'absent'
              ? 'rgba(251, 113, 133, 0.55)'
              : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, boxH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 15px Cairo, sans-serif';
        ctx.fillText(sess.sessionTitle, x + boxW - 18, y + 32);

        ctx.textAlign = 'left';
        ctx.fillStyle =
          sess.status === 'present'
            ? '#34D399'
            : sess.status === 'absent'
              ? '#FB7185'
              : '#94A3B8';
        ctx.font = '900 15px Cairo, sans-serif';
        ctx.fillText(sess.statusLabelAr, x + 18, y + 32);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 19px Cairo, sans-serif';
        ctx.fillText(sess.fullSentenceAr, x + boxW - 18, y + 76);
      });

      const footerY = height - 54;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 18px Cairo, sans-serif';
      ctx.fillText('إشراف واعتماد: مستر محمد الجزار', width - 60, footerY);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '800 17px Cairo, sans-serif';
      ctx.fillText(`للتواصل واتساب: ${TEACHER_PHONE_LOCAL}`, 60, footerY);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `حضور-${student.name}-${currentMonthRecord.monthNameAr}-مستر-محمد-الجزار.png`;
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
    <AnimatePresence mode="wait">
      {activeTab === 'choice' && (
        <motion.div
          key="view-student-hub"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          aria-label="بوابة بيانات الطالب"
          data-testid="student-dashboard"
          className="space-y-4 text-right"
        >
          {/* 1. بطاقة تعريف الطالب الهادئة وحالة الدفع واختيار الصفحة المطلوبة */}
          <div className="bg-slate-900/85 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 no-print">
            {/* الصف العلوي: زر بحث جديد + شارة التوثيق */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
              <button
                type="button"
                onClick={onResetSearch}
                data-testid="reset-search-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-cyan-300" />
                <span>{backButtonLabel || 'بحث عن كود طالب آخر'}</span>
              </button>

              <div className="inline-flex items-center gap-1.5 text-cyan-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم التحقق من كود الطالب بنجاح</span>
              </div>
            </div>

            {/* بيانات الطالب الأساسية وحالة الدفع */}
            <div className="bg-slate-950/65 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="space-y-2 min-w-0">
                <div className="text-xs font-bold text-cyan-300/90">بيانات الطالب المسجلة:</div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
                  {student.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 text-cyan-200">
                    <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>الصف {student.grade}</span>
                  </span>

                  {!hideStudentCode && student.id && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-300 font-mono-num">
                        <Hash className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>كود الطالب: {student.id}</span>
                      </span>
                    </>
                  )}

                  {student.group && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{student.group}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* حالة الدفع للشهر السابق والشهر الحالي داخل مربع بيانات الطالب */}
              <div
                data-testid="student-payment-box"
                className="pt-3.5 border-t border-white/10 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-cyan-300">
                    <CreditCard className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>حالة سداد المصروفات الشهرية</span>
                  </div>

                  {paymentSummary?.recordedPaymentDate && (
                    <div
                      data-testid="payment-recorded-date"
                      className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-emerald-300"
                    >
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>تاريخ تسجيل الدفع:</span>
                      <span dir="ltr" className="font-mono-num font-black text-emerald-200">
                        {paymentSummary.recordedPaymentDate}
                      </span>
                    </div>
                  )}
                </div>

                {!isPaymentLoaded ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="h-[58px] rounded-xl bg-slate-900/60 border border-white/10 animate-pulse" />
                    <div className="h-[58px] rounded-xl bg-slate-900/60 border border-white/10 animate-pulse" />
                  </div>
                ) : paymentSummary ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        key: 'prev',
                        item: paymentSummary.previousMonth,
                        testId: 'payment-prev-month',
                      },
                      {
                        key: 'curr',
                        item: paymentSummary.currentMonth,
                        testId: 'payment-curr-month',
                      },
                    ].map(({ key, item, testId }) => {
                      const toneStyles: Record<
                        PaymentStatusTone,
                        { box: string; statusText: string; icon: React.ReactNode }
                      > = {
                        paid: {
                          box: 'bg-emerald-950/35 border-emerald-400/40',
                          statusText: 'text-emerald-300',
                          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
                        },
                        exempt: {
                          box: 'bg-cyan-950/35 border-cyan-400/40',
                          statusText: 'text-cyan-300',
                          icon: <Gift className="w-4 h-4 text-cyan-400 shrink-0" />,
                        },
                        pending: {
                          box: 'bg-slate-900/75 border-white/12',
                          statusText: 'text-slate-300',
                          icon: <Clock className="w-4 h-4 text-slate-400 shrink-0" />,
                        },
                        late: {
                          box: 'bg-amber-950/35 border-amber-400/45',
                          statusText: 'text-amber-300',
                          icon: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />,
                        },
                        unpaid: {
                          box: 'bg-rose-950/40 border-rose-400/50',
                          statusText: 'text-rose-300',
                          icon: <XCircle className="w-4 h-4 text-rose-400 shrink-0" />,
                        },
                        overdue: {
                          box: 'bg-rose-950/40 border-rose-400/50',
                          statusText: 'text-rose-300',
                          icon: <XCircle className="w-4 h-4 text-rose-400 shrink-0" />,
                        },
                      };

                      const visual = toneStyles[item.status.tone];

                      return (
                        <div
                          key={key}
                          data-testid={testId}
                          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${visual.box}`}
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-400 truncate">
                              {item.label}
                            </div>
                            <div
                              className={`text-xs sm:text-sm font-black mt-0.5 ${visual.statusText}`}
                            >
                              {item.status.displayText}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center justify-center">
                            {visual.icon}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-400 py-1">
                    لم تُدرج بيانات سداد لهذا الكود في سجل الدفع حتى الآن.
                  </div>
                )}
              </div>
            </div>

            {/* اختيار الانتقال إلى صفحة النتيجة والشهادة أو صفحة سجل الحضور والغياب */}
            <div className="space-y-2.5">
              <div className="text-xs sm:text-sm font-black text-slate-200">
                اختر الصفحة المطلوب الدخول إليها:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="select-view-grades"
                  onClick={() => navigateSubView('grades')}
                  className="p-3.5 sm:p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 bg-slate-950/70 hover:bg-gradient-to-l hover:from-cyan-500/15 hover:to-slate-950 border-white/10 hover:border-cyan-400/50 shadow-sm hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-cyan-500/15 text-cyan-300 border-cyan-400/30">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-black text-white">
                        عرض النتيجة والشهادة
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                        درجات الاختبارات · التقدير العام · طباعة PDF
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-black whitespace-nowrap shrink-0 bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                    عرض النتيجة ←
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="select-view-attendance"
                  onClick={() => navigateSubView('attendance')}
                  className="p-3.5 sm:p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 bg-slate-950/70 hover:bg-gradient-to-l hover:from-emerald-500/15 hover:to-slate-950 border-white/10 hover:border-emerald-400/50 shadow-sm hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-500/15 text-emerald-300 border-emerald-400/30">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-black text-white">
                        عرض سجل الحضور والغياب
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                        تحليل الحضور الشهري · جدول الحصص · طباعة PDF
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-black whitespace-nowrap shrink-0 bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    عرض الحضور ←
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'grades' && (
        <motion.div
          key="page-grades-dedicated"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          data-testid="dedicated-grades-page"
          aria-label="صفحة النتيجة والشهادة"
          className="space-y-4 text-right"
        >
          {/* شريط التنقل العلوي لصفحة النتيجة المستقلة */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2.5 no-print">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                data-testid="back-to-student-hub-btn"
                onClick={() => navigateSubView('choice')}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <ArrowRight className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>العودة لبيانات الطالب</span>
              </button>

              <button
                type="button"
                data-testid="switch-to-attendance-btn"
                onClick={() => navigateSubView('attendance')}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-emerald-500/12 hover:bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 font-black text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>الانتقال لسجل الحضور</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCertificateImage}
                disabled={isExportingImage}
                data-testid="download-certificate-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-400/35 text-cyan-200 font-black text-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>{isExportingImage ? 'جاري التجهيز...' : 'تنزيل الشهادة كصورة'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintDocument}
                data-testid="print-certificate-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span>طباعة الشهادة (PDF)</span>
              </button>
            </div>
          </div>

          {/* بطاقة الشهادة المنسقة والهادئة */}
          <div
            id="printable-certificate"
            className="print-certificate-frame bg-slate-900/85 backdrop-blur-2xl border border-cyan-400/30 rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* 1. هيدر الشهادة */}
            <div className="bg-gradient-to-l from-cyan-500/15 via-teal-500/10 to-slate-950/85 border-b border-white/10 p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-right">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-cyan-400/75 ring-4 ring-cyan-400/15 bg-slate-950 p-1 shadow-xl overflow-hidden shrink-0">
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

                    {honorRank && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-200">
                        <Award className="w-4 h-4 text-cyan-300" />
                        <span>🏆 المركز #{honorRank} في لوحة الشرف</span>
                      </span>
                    )}

                    {!hideStudentCode && student.id && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">
                        <Hash className="w-3.5 h-3.5 text-emerald-400" />
                        <span>كود الطالب: {student.id}</span>
                      </span>
                    )}

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
                        style={{
                          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
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
                        className="bg-slate-950/75 border border-white/10 hover:border-cyan-400/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-colors overflow-hidden"
                      >
                        {card.isTextValue ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="p-2 rounded-xl bg-slate-900 border border-white/10 shrink-0">
                                  {renderCategoryIcon(card.categoryIcon)}
                                </div>
                                <h4 className="text-sm sm:text-base font-black text-white leading-snug break-words">
                                  {card.cleanTitle}
                                </h4>
                              </div>

                              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-black whitespace-nowrap shrink-0">
                                {card.levelLabel}
                              </span>
                            </div>

                            <div
                              dir="rtl"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-emerald-400/30 text-emerald-300 text-xs sm:text-sm font-black leading-relaxed break-words text-right"
                            >
                              {card.rawValue}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="p-2 rounded-xl bg-slate-900 border border-white/10 shrink-0">
                                  {renderCategoryIcon(card.categoryIcon)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm sm:text-base font-black text-white leading-snug break-words">
                                    {card.cleanTitle}
                                  </h4>
                                  <span className="text-[11px] font-bold text-slate-300 inline-flex items-center gap-1 mt-0.5">
                                    <CheckCircle2
                                      className={`w-3 h-3 shrink-0 ${
                                        card.isPending ? 'text-slate-400' : 'text-emerald-400'
                                      }`}
                                    />
                                    <span>المستوى: {card.levelLabel}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="text-left shrink-0 bg-slate-900/85 border border-white/10 px-3 py-1.5 rounded-xl">
                                <div
                                  dir="ltr"
                                  className={`text-sm sm:text-base font-black font-mono-num whitespace-nowrap ${scoreTextColor}`}
                                >
                                  {card.rawValue}
                                </div>
                                {!card.isAttendanceOrPercentageOnly && !card.isPending && (
                                  <div
                                    dir="ltr"
                                    className="text-[10px] font-bold text-slate-400 font-mono-num whitespace-nowrap text-center"
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
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. ملاحظات الشيت */}
              {student.note && (
                <div
                  data-testid="teacher-note"
                  className="bg-gradient-to-l from-cyan-500/10 via-teal-500/5 to-slate-950/60 border border-cyan-400/25 p-4 sm:p-5 rounded-2xl space-y-2 overflow-hidden"
                >
                  <div className="text-xs sm:text-sm font-black text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>ملاحظات مسجلة:</span>
                  </div>
                  <p className="text-xs sm:text-base text-white font-bold leading-relaxed break-words">
                    «{student.note}»
                  </p>
                </div>
              )}

              {/* 5. تذييل الشهادة الرسمي */}
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

          {/* أزرار الطباعة والتنزيل أسفل الشهادة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 no-print">
            <button
              type="button"
              onClick={handleDownloadCertificateImage}
              disabled={isExportingImage}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-cyan-400/35 hover:border-cyan-400 text-cyan-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-5 h-5 text-cyan-300 shrink-0" />
              <span>{isExportingImage ? 'جاري التحميل...' : 'تنزيل الشهادة كصورة'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintDocument}
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
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-emerald-400/35 hover:border-emerald-400 text-emerald-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>تواصل مع مستر محمد الجزار</span>
            </a>
          </div>
        </motion.div>
      )}

      {activeTab === 'attendance' && (
        <motion.div
          key="page-attendance-dedicated"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          data-testid="dedicated-attendance-page"
          aria-label="صفحة سجل الحضور والغياب"
          className="space-y-4 text-right"
        >
          {/* شريط التنقل العلوي لصفحة الحضور والغياب المستقلة */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-emerald-400/30 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2.5 no-print">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                data-testid="back-to-student-hub-btn"
                onClick={() => navigateSubView('choice')}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <ArrowRight className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>العودة لبيانات الطالب</span>
              </button>

              <button
                type="button"
                data-testid="switch-to-grades-btn"
                onClick={() => navigateSubView('grades')}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-cyan-500/12 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 font-black text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>عرض النتيجة والشهادة</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadAttendanceImage}
                disabled={isExportingImage || !currentMonthRecord}
                data-testid="download-attendance-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-400/35 text-cyan-200 font-black text-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>{isExportingImage ? 'جاري التجهيز...' : 'تنزيل الحضور كصورة'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintDocument}
                data-testid="print-attendance-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span>طباعة سجل الحضور (PDF)</span>
              </button>
            </div>
          </div>

          {/* شريط مؤشرات الالتزام التراكمي + تبويبة اختيار الشهر المنسدلة */}
          <div
            data-testid="attendance-term-insights"
            className="relative z-20 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl no-print"
          >
            {/* شريط الهوية والتحديث */}
            <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-white/10">
              <div className="font-black text-white flex flex-wrap items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{student.name}</span>
                <span className="text-slate-600">·</span>
                <span className="text-cyan-300">الصف {student.grade}</span>
              </div>

              {attendanceData && (
                <div className="text-slate-400 font-bold flex flex-wrap items-center gap-2">
                  <span>أيام الحصص: {attendanceData.scheduleDaysLabel}</span>
                  {attendanceData.lastUpdatedDate && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span>
                        آخر تحديث:{' '}
                        <span dir="ltr" className="font-mono-num text-slate-200">
                          {attendanceData.lastUpdatedDate}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* الإحصائيات التراكمية بفواصل معمارية هادئة (بدون صناديق متكررة) */}
            {attendanceData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-white/10 border-b border-white/10">
                <div className="px-4 py-3 text-right">
                  <div className="text-[11px] font-bold text-slate-400">سلسلة الالتزام الحالية</div>
                  <div className="text-sm sm:text-base font-black text-emerald-300 font-mono-num mt-0.5 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{formatArabicSessionCount(attendanceData.consecutivePresentStreak, true)}</span>
                  </div>
                </div>

                <div className="px-4 py-3 text-right">
                  <div className="text-[11px] font-bold text-slate-400">إجمالي الحضور التراكمي</div>
                  <div className="text-sm sm:text-base font-black text-cyan-300 font-mono-num mt-0.5">
                    {attendanceData.totalRecordedPresent} /{' '}
                    {formatArabicSessionCount(attendanceData.totalRecordedSessions)}
                  </div>
                </div>

                <div className="px-4 py-3 text-right">
                  <div className="text-[11px] font-bold text-slate-400">إجمالي الغياب</div>
                  <div
                    className={`text-sm sm:text-base font-black font-mono-num mt-0.5 ${
                      attendanceData.totalRecordedAbsent > 0 ? 'text-rose-300' : 'text-slate-200'
                    }`}
                  >
                    {formatArabicSessionCount(attendanceData.totalRecordedAbsent)}
                  </div>
                </div>

                <div className="px-4 py-3 text-right">
                  <div className="text-[11px] font-bold text-slate-400">نسبة الالتزام العامة</div>
                  <div
                    dir="ltr"
                    className="text-sm sm:text-base font-black text-white font-mono-num mt-0.5 text-right sm:text-left"
                  >
                    {attendanceData.overallTermAttendancePercentage}%
                  </div>
                </div>
              </div>
            )}

            {/* شريط تبويبة اختيار الشهر (قائمة منسدلة أنيقة + أزرار التنقل السريع بين الشهور) */}
            <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-950/35 rounded-b-2xl">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-200 whitespace-nowrap shrink-0">
                <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>سجل حضور الشهر:</span>
                <span className="text-[11px] font-bold text-slate-400 hidden lg:inline">
                  · اختر أي شهر من القائمة
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto" ref={monthDropdownRef}>
                {/* زر الشهر السابق */}
                <button
                  type="button"
                  data-testid="month-prev-btn"
                  aria-label="الشهر السابق"
                  disabled={
                    (attendanceData?.availableMonths || ACADEMIC_MONTHS_ORDER).indexOf(
                      selectedMonth
                    ) <= 0
                  }
                  onClick={() => handleStepMonth(-1)}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* تبويبة القائمة المنسدلة للشهر */}
                <div className="relative flex-1 sm:flex-initial sm:min-w-[260px]">
                  <button
                    type="button"
                    data-testid="month-dropdown-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isMonthMenuOpen}
                    onClick={() => setIsMonthMenuOpen((prev) => !prev)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isMonthMenuOpen
                        ? 'bg-slate-900 border-cyan-400 text-white shadow-[0_0_0_2px_rgba(34,211,238,0.18)]'
                        : 'bg-slate-950/85 hover:bg-slate-900 border-cyan-400/35 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-black text-white truncate">
                        شهر {selectedMonth} ({ARABIC_MONTH_NAMES[selectedMonth]})
                      </span>
                      {selectedMonth === (attendanceData?.currentMonthNumber || 11) ? (
                        <span className="text-[11px] font-black text-cyan-300 whitespace-nowrap shrink-0">
                          · الحالي
                        </span>
                      ) : currentMonthRecord?.absentCount ? (
                        <span className="text-[11px] font-black text-rose-300 whitespace-nowrap shrink-0">
                          · غياب {currentMonthRecord.absentCount}
                        </span>
                      ) : currentMonthRecord?.hasSheetRecords ? (
                        <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap shrink-0">
                          · مسجل
                        </span>
                      ) : null}
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-cyan-300 shrink-0 transition-transform duration-200 ${
                        isMonthMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isMonthMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="قائمة الشهور الدراسية"
                      data-testid="month-dropdown-menu"
                      className="absolute left-0 right-0 mt-2 z-50 bg-slate-950/98 backdrop-blur-2xl border border-cyan-400/35 rounded-2xl shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1"
                    >
                      {(attendanceData?.availableMonths || ACADEMIC_MONTHS_ORDER).map((mNum) => {
                        const isSelected = selectedMonth === mNum;
                        const isCurrentCalendarMonth =
                          mNum === (attendanceData?.currentMonthNumber || 11);
                        const mStats = attendanceData?.months?.[mNum];
                        const hasAbsences = Boolean(mStats && mStats.absentCount > 0);
                        const hasRecords = Boolean(mStats && mStats.hasSheetRecords);

                        return (
                          <button
                            key={mNum}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            data-testid={`attendance-month-btn-${mNum}`}
                            onClick={() => handleSelectMonth(mNum)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-right transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/20 border border-cyan-400/50 text-white font-black'
                                : 'hover:bg-white/5 border border-transparent text-slate-200 font-bold'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 flex items-center justify-center shrink-0">
                                {isSelected && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                              </span>
                              <span className="text-xs sm:text-sm whitespace-nowrap">
                                شهر {mNum} ({ARABIC_MONTH_NAMES[mNum]})
                              </span>
                            </div>

                            <span
                              className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                                hasAbsences
                                  ? 'text-rose-300'
                                  : isCurrentCalendarMonth
                                    ? 'text-cyan-300'
                                    : hasRecords
                                      ? 'text-emerald-300'
                                      : 'text-slate-500'
                              }`}
                            >
                              {hasAbsences
                                ? `غياب (${mStats!.absentCount})`
                                : isCurrentCalendarMonth
                                  ? 'الشهر الحالي'
                                  : hasRecords
                                    ? `${mStats!.presentCount} / ${mStats!.recordedCount} حصة`
                                    : 'غير مسجل'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* زر الشهر التالي */}
                <button
                  type="button"
                  data-testid="month-next-btn"
                  aria-label="الشهر التالي"
                  disabled={
                    (attendanceData?.availableMonths || ACADEMIC_MONTHS_ORDER).indexOf(
                      selectedMonth
                    ) >=
                    (attendanceData?.availableMonths || ACADEMIC_MONTHS_ORDER).length - 1
                  }
                  onClick={() => handleStepMonth(1)}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* وثيقة سجل الحضور الشهري القابلة للطباعة كـ PDF */}
          {currentMonthRecord && (
            <div
              id="printable-attendance"
              className="print-certificate-frame bg-slate-900/90 backdrop-blur-2xl border border-white/12 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* خط علوي زخرفي هادئ للوثيقة */}
              <div className="h-1 w-full bg-gradient-to-l from-cyan-400 via-teal-400 to-emerald-400" />

              {/* هيدر بيان الحضور (يظهر في الشاشة وفي طباعة PDF) */}
              <div className="bg-gradient-to-l from-slate-950 via-slate-900/95 to-emerald-950/25 border-b border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-2xl border-2 border-cyan-400/65 bg-slate-950 p-0.5 shadow-lg overflow-hidden shrink-0">
                    {!avatarError ? (
                      <img
                        src={TEACHER_AVATAR_URL}
                        alt="مستر محمد الجزار"
                        onError={() => setAvatarError(true)}
                        className="w-full h-full object-cover object-top rounded-xl"
                      />
                    ) : (
                      <User className="w-8 h-8 text-cyan-400 m-auto" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] sm:text-xs font-black text-cyan-300">
                      منصة مستر محمد الجزار — بيان متابعة الحضور والغياب الشهري
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                      {student.name} — الصف {student.grade}
                    </h3>
                    <div className="text-xs font-bold text-slate-300 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span>{currentMonthRecord.monthDisplayTitle}</span>
                      {attendanceData?.scheduleDaysLabel && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span>أيام الحصص: {attendanceData.scheduleDaysLabel}</span>
                        </>
                      )}
                      {!hideStudentCode && student.id && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="font-mono-num text-emerald-300">
                            كود الطالب: {student.id}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                  <div className="inline-flex items-center gap-1.5 text-emerald-300 text-xs sm:text-sm font-black">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{currentMonthRecord.commitmentBadge}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    تاريخ البيان: {issueDateFormatted}
                  </span>
                </div>
              </div>

              {/* جسم سجل الحضور الشهري */}
              <div className="p-5 sm:p-6 space-y-6">
                {/* شريط الملخص الشهري الموحّد بفواصل معمارية */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-white/10 bg-slate-950/55 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-3.5 text-center">
                    <div className="text-[11px] font-bold text-slate-400">الشهر الدراسي</div>
                    <div
                      data-testid="attendance-month-title"
                      className="text-sm sm:text-base font-black text-cyan-300 mt-1"
                    >
                      {currentMonthRecord.monthDisplayTitle}
                    </div>
                  </div>

                  <div className="p-3.5 text-center">
                    <div className="text-[11px] font-bold text-slate-400">مرات الحضور</div>
                    <div className="text-sm sm:text-base font-black text-emerald-300 font-mono-num mt-1">
                      {formatArabicSessionCount(currentMonthRecord.presentCount)}
                    </div>
                  </div>

                  <div className="p-3.5 text-center">
                    <div className="text-[11px] font-bold text-slate-400">مرات الغياب</div>
                    <div
                      className={`text-sm sm:text-base font-black font-mono-num mt-1 ${
                        currentMonthRecord.absentCount > 0 ? 'text-rose-300' : 'text-slate-300'
                      }`}
                    >
                      {formatArabicSessionCount(currentMonthRecord.absentCount)}
                    </div>
                  </div>

                  <div className="p-3.5 text-center space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">نسبة حضور الشهر</div>
                    <div
                      dir="ltr"
                      className="text-sm sm:text-base font-black text-white font-mono-num"
                    >
                      {currentMonthRecord.recordedCount > 0
                        ? `${currentMonthRecord.attendancePercentage}%`
                        : '—'}
                    </div>
                    {currentMonthRecord.recordedCount > 0 && (
                      <div className="w-24 mx-auto h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            currentMonthRecord.attendancePercentage >= 85
                              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                              : currentMonthRecord.attendancePercentage >= 65
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                          }`}
                          style={{ width: `${currentMonthRecord.attendancePercentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {!currentMonthRecord.hasSheetRecords && currentMonthRecord.recordedCount === 0 && (
                  <div
                    data-testid="attendance-unrecorded-month-notice"
                    className="bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-2.5"
                  >
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      لم تُسجّل حصص {currentMonthRecord.monthDisplayTitle} في سجل الحضور الإلكتروني بعد، وتظهر تواريخ المواعيد المجدولة فقط.
                    </span>
                  </div>
                )}

                {/* المسار الزمني المتصل للحصص (Connected Visual Stepper Timeline) */}
                <div data-testid="attendance-timeline-bar" className="space-y-3.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-xs sm:text-sm">
                        المسار الزمني لحصص {currentMonthRecord.monthNameAr}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] font-bold text-cyan-300 font-mono-num">
                        مكتمل {currentMonthRecord.recordedCount} من{' '}
                        {currentMonthRecord.sessions.length} حصص
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                      <span className="inline-flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        حضر
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-300">
                        <XCircle className="w-3.5 h-3.5" />
                        غاب
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        قادمة
                      </span>
                    </div>
                  </div>

                  {/* خط المسار المتصل */}
                  <div className="relative bg-slate-950/55 border border-white/10 rounded-2xl px-3 sm:px-5 py-4">
                    {/* السكة الأفقية المتصلة على الشاشات المتوسطة والكبيرة */}
                    <div
                      aria-hidden="true"
                      className="hidden sm:block absolute top-[34px] left-10 right-10 h-0.5 bg-slate-800"
                    />
                    <div
                      aria-hidden="true"
                      className="hidden sm:block absolute top-[34px] right-10 h-0.5 bg-gradient-to-l from-emerald-400 to-cyan-400 transition-all duration-500"
                      style={{
                        width:
                          currentMonthRecord.sessions.length > 1 &&
                          currentMonthRecord.recordedCount > 0
                            ? `calc(${Math.min(
                                100,
                                Math.round(
                                  ((currentMonthRecord.recordedCount - 0.5) /
                                    currentMonthRecord.sessions.length) *
                                    100
                                )
                              )}% - 20px)`
                            : '0%',
                      }}
                    />

                    <div className="relative z-10 grid grid-cols-4 sm:grid-cols-8 gap-y-4 gap-x-2">
                      {currentMonthRecord.sessions.map((sess) => {
                        const isSelectedNode = highlightedSessionIndex === sess.sessionIndex;
                        const nodeRing =
                          sess.status === 'present'
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                            : sess.status === 'absent'
                              ? 'bg-rose-950 border-rose-400 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.22)]'
                              : sess.status === 'late'
                                ? 'bg-amber-950 border-amber-400 text-amber-300'
                                : sess.status === 'excused'
                                  ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                                  : 'bg-slate-900 border-white/15 text-slate-400';

                        return (
                          <button
                            key={`tl-${sess.sessionIndex}-${sess.isoDate}`}
                            type="button"
                            data-testid={`timeline-step-${sess.sessionIndex}`}
                            title={sess.fullSentenceAr}
                            onClick={() => {
                              setSessionFilter('all');
                              setHighlightedSessionIndex((prev) =>
                                prev === sess.sessionIndex ? null : sess.sessionIndex
                              );
                            }}
                            className="group flex flex-col items-center text-center gap-1.5 cursor-pointer focus-visible:outline-none"
                          >
                            <span
                              className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${nodeRing} ${
                                isSelectedNode
                                  ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950 scale-105'
                                  : ''
                              }`}
                            >
                              {sess.status === 'present' && (
                                <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
                              )}
                              {sess.status === 'absent' && (
                                <XCircle className="w-4 h-4 stroke-[2.4]" />
                              )}
                              {sess.status === 'late' && <Clock className="w-4 h-4 stroke-[2.4]" />}
                              {sess.status === 'excused' && (
                                <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
                              )}
                              {sess.status === 'upcoming' && (
                                <span className="text-xs font-black font-mono-num">
                                  {sess.sessionIndex}
                                </span>
                              )}
                            </span>

                            <div className="leading-tight">
                              <div
                                dir="ltr"
                                className={`text-[11px] font-black font-mono-num ${
                                  sess.status === 'upcoming' ? 'text-slate-400' : 'text-white'
                                }`}
                              >
                                {sess.shortDate}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {sess.dayNameAr}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* تنبيه مواعيد الغياب المسجلة في هذا الشهر إن وجدت */}
                {missedSessionsInMonth.length > 0 && (
                  <div
                    data-testid="attendance-absence-alert"
                    className="bg-rose-950/35 border border-rose-400/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm font-bold text-rose-100">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-rose-200">أيام الغياب المسجلة: </span>
                        <span>
                          {missedSessionsInMonth
                            .map((s) => `${s.dayNameAr} ${s.shortDate}`)
                            .join(' · ')}
                        </span>
                      </div>
                    </div>

                    <a
                      href={whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-emerald-300 hover:text-emerald-200 whitespace-nowrap shrink-0 underline underline-offset-4 no-print"
                    >
                      إرسال عذر عبر واتساب ←
                    </a>
                  </div>
                )}

                {/* شبكة تفاصيل الحصص باليوم والتاريخ + أزرار الفلترة */}
                <div className="space-y-3.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        تفاصيل حصص {currentMonthRecord.monthDisplayTitle} باليوم والتاريخ
                      </span>
                    </h4>

                    {/* فلاتر عرض الحصص */}
                    <div
                      role="group"
                      aria-label="تصفية حصص الشهر"
                      className="inline-flex items-center gap-1 p-1 bg-slate-950/85 border border-white/10 rounded-xl no-print"
                    >
                      {(
                        [
                          { id: 'all', label: `الكل (${currentMonthRecord.sessions.length})` },
                          {
                            id: 'present',
                            label: `الحضور (${
                              currentMonthRecord.presentCount +
                              currentMonthRecord.excusedCount +
                              currentMonthRecord.lateCount
                            })`,
                          },
                          { id: 'absent', label: `الغياب (${currentMonthRecord.absentCount})` },
                          {
                            id: 'upcoming',
                            label: `القادمة (${currentMonthRecord.upcomingCount})`,
                          },
                        ] as const
                      ).map((tab) => {
                        const isActive = sessionFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            data-testid={`attendance-filter-${tab.id}`}
                            onClick={() => {
                              setSessionFilter(tab.id);
                              setHighlightedSessionIndex(null);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-cyan-500 text-slate-950'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {filteredSessions.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {filteredSessions.map((sess) => {
                        const isPresent = sess.status === 'present';
                        const isAbsent = sess.status === 'absent';
                        const isLate = sess.status === 'late';
                        const isExcused = sess.status === 'excused';
                        const isHighlighted = highlightedSessionIndex === sess.sessionIndex;

                        const cardSurface = isPresent
                          ? 'bg-emerald-950/20 border-emerald-400/30 hover:border-emerald-400/55'
                          : isAbsent
                            ? 'bg-rose-950/30 border-rose-400/45 hover:border-rose-400/65'
                            : isLate
                              ? 'bg-amber-950/25 border-amber-400/35'
                              : isExcused
                                ? 'bg-cyan-950/25 border-cyan-400/35'
                                : 'bg-slate-950/50 border-white/10';

                        const statusColor = isPresent
                          ? 'text-emerald-300'
                          : isAbsent
                            ? 'text-rose-300'
                            : isLate
                              ? 'text-amber-300'
                              : isExcused
                                ? 'text-cyan-300'
                                : 'text-slate-400';

                        const accentStrip = isPresent
                          ? 'bg-emerald-400/75'
                          : isAbsent
                            ? 'bg-rose-400/80'
                            : isLate
                              ? 'bg-amber-400/75'
                              : isExcused
                                ? 'bg-cyan-400/75'
                                : 'bg-slate-800';

                        const subCaption = isPresent
                          ? 'تم تسجيل الحضور'
                          : isAbsent
                            ? 'تم تسجيل الغياب'
                            : isLate
                              ? 'حضر متأخراً'
                              : isExcused
                                ? 'غياب بعذر مقبول'
                                : sess.statusLabelAr === 'غير مسجل بعد'
                                  ? 'لم يُسجَّل في الشيت بعد'
                                  : 'موعد الحصة القادمة';

                        return (
                          <div
                            key={`${sess.sessionIndex}-${sess.isoDate}`}
                            data-testid="attendance-session-box"
                            className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${cardSurface} ${
                              isHighlighted
                                ? 'ring-2 ring-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                                : ''
                            }`}
                          >
                            <div className="p-3.5 space-y-2.5">
                              {/* الصف العلوي: رقم الحصة + حالة الحضور بدون كبسولات مكدسة */}
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-bold text-slate-400">
                                  {sess.sessionTitle}
                                </span>
                                <span
                                  className={`font-black inline-flex items-center gap-1 whitespace-nowrap ${statusColor}`}
                                >
                                  {isPresent && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                  {isAbsent && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                                  {isLate && <Clock className="w-3.5 h-3.5 shrink-0" />}
                                  {isExcused && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
                                  {!isPresent && !isAbsent && !isLate && !isExcused && (
                                    <Clock className="w-3 h-3 shrink-0 opacity-75" />
                                  )}
                                  <span>{sess.statusLabelAr}</span>
                                </span>
                              </div>

                              {/* التاريخ واليوم بوضوح وتباين عالٍ */}
                              <div>
                                <div className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                                  <span>{sess.dayNameAr}</span>
                                  <span className="text-slate-600">·</span>
                                  <span dir="ltr" className="font-mono-num text-cyan-200">
                                    {sess.shortDate}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                                  {subCaption}
                                </div>
                              </div>
                            </div>

                            {/* شريط دلالي سفلي رفيع */}
                            <div className={`h-1 w-full ${accentStrip}`} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-950/55 border border-white/10 rounded-2xl p-6 text-center text-xs sm:text-sm font-bold text-slate-300">
                      لا توجد حصص مطابقة للتصفية المختارة في هذا الشهر.
                    </div>
                  )}
                </div>

                {/* تذييل بيان الحضور للطباعة */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>سجل حضور مستخرج من منصة مستر محمد الجزار للرياضيات</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span dir="ltr" className="text-cyan-300 font-black font-mono-num">
                      {TEACHER_PHONE_LOCAL}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-white font-black">إشراف: مستر محمد الجزار</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* أزرار طباعة سجل الحضور كـ PDF أو تنزيله كصورة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 no-print">
            <button
              type="button"
              onClick={handleDownloadAttendanceImage}
              disabled={isExportingImage}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-cyan-400/35 hover:border-cyan-400 text-cyan-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-5 h-5 text-cyan-300 shrink-0" />
              <span>{isExportingImage ? 'جاري التحميل...' : 'تنزيل سجل الحضور كصورة'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintDocument}
              data-testid="print-attendance-pdf-btn"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-5 h-5 stroke-[2.5] shrink-0" />
              <span>طباعة سجل الحضور (PDF / ورقية)</span>
            </button>

            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/85 hover:bg-slate-900 border border-emerald-400/35 hover:border-emerald-400 text-emerald-200 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>تواصل مع مستر محمد الجزار</span>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
