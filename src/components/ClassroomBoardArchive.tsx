import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  GraduationCap,
  Layers,
  Lock,
  Maximize2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { StudentRecord } from '../data/mockDatabase';
import {
  BoardLessonItem,
  FormattedBoardImage,
  fetchAllLiveBoardsFromSheet,
} from '../services/boardService';
import {
  STAGES,
  StageId,
  TEACHER_PHONE_INTL,
  getStageForGrade,
} from '../utils/grading';

interface ClassroomBoardArchiveProps {
  activeStudent: StudentRecord | null;
  availableGrades: string[];
  isLoadingStudent?: boolean;
  errorMessage?: string | null;
  onLookupStudent?: (grade: string, code: string) => Promise<void>;
  onSwitchStudent?: () => void;
}

type BranchFilter = 'الكل' | 'حساب' | 'جبر' | 'هندسة' | 'حساب مثلثات';

const STAGE_CARDS: {
  id: StageId;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  accentGradient: string;
  iconBg: string;
  icon: 'primary' | 'prep' | 'secondary';
}[] = [
  {
    id: 'primary',
    shortTitle: 'الابتدائية',
    fullTitle: 'المرحلة الابتدائية',
    subtitle: 'الصف الرابع · الخامس · السادس',
    accentGradient: 'from-cyan-500/25 via-teal-500/15 to-transparent',
    iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/35',
    icon: 'primary',
  },
  {
    id: 'prep',
    shortTitle: 'الإعدادية',
    fullTitle: 'المرحلة الإعدادية',
    subtitle: 'الصف الأول · الثاني · الثالث',
    accentGradient: 'from-emerald-500/25 via-teal-500/15 to-transparent',
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/35',
    icon: 'prep',
  },
  {
    id: 'secondary',
    shortTitle: 'الثانوية',
    fullTitle: 'المرحلة الثانوية',
    subtitle: 'الصف الأول · الثاني · الثالث',
    accentGradient: 'from-violet-500/25 via-indigo-500/15 to-transparent',
    iconBg: 'bg-violet-500/20 text-violet-300 border-violet-400/35',
    icon: 'secondary',
  },
];

function renderMathStageIcon(icon: 'primary' | 'prep' | 'secondary') {
  if (icon === 'primary') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
        aria-hidden="true"
      >
        <path d="M4 20L20 20L4 4Z" />
        <path d="M7.5 16.5L13.5 16.5L7.5 10.5Z" strokeWidth="1.6" />
        <path d="M4 16H8V20" strokeWidth="1.6" />
      </svg>
    );
  }

  if (icon === 'prep') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
        aria-hidden="true"
      >
        <path d="M12 2V4" />
        <circle cx="12" cy="6" r="2" />
        <path d="M10.5 7.5L5.5 20" />
        <path d="M13.5 7.5L18.5 20" />
        <path d="M7.5 14.5C9.2 15.8 14.8 15.8 16.5 14.5" strokeDasharray="2 2" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-7 h-7"
      aria-hidden="true"
    >
      <path d="M4.5 7.5C6.5 6.5 9 6.5 19.5 6.5" />
      <path d="M9.5 6.5C9.3 11.5 8.5 15.5 6.5 18.5" />
      <path d="M15.2 6.5V15.5C15.2 17.4 16.2 18.5 17.8 18.5C18.8 18.5 19.5 17.9 19.8 17" />
    </svg>
  );
}

function buildBoardQuestionWhatsAppUrl(
  student: StudentRecord | null,
  item: BoardLessonItem
): string {
  const lines = [
    'السلام عليكم يا مستر محمد الجزار 🌟',
    student
      ? `أنا الطالب: *${student.name}* (كود: ${student.id})`
      : `الصف الدراسي: *الصف ${item.grade}*`,
    student ? `الصف الدراسي: *الصف ${student.grade}*` : '',
    `لدي سؤال في سبورة: *${item.sessionAndBranch}*`,
    `عنوان الدرس: *${item.lessonTitle}* (${item.dateLabel})`,
    'سؤالي هو: ',
  ].filter(Boolean);
  return `https://wa.me/${TEACHER_PHONE_INTL}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function triggerBoardImageDownload(
  image: FormattedBoardImage,
  lessonTitle: string,
  slideNumber: number
) {
  if (!image.downloadUrl) return;

  const link = document.createElement('a');
  link.href = image.downloadUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const safeName = lessonTitle.replace(/\s+/g, '-').slice(0, 50);
  link.download = `سبورة-مستر-محمد-الجزار-${safeName}-${slideNumber}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface BoardCardProps {
  item: BoardLessonItem;
  isFirstNewest: boolean;
  student: StudentRecord | null;
  onOpenLightbox: (item: BoardLessonItem, initialIndex: number) => void;
}

const BoardCard: React.FC<BoardCardProps> = ({
  item,
  isFirstNewest,
  student,
  onOpenLightbox,
}) => {
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [useFallbackImg, setUseFallbackImg] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setCurrentImgIdx(0);
    setUseFallbackImg({});
  }, [item.id, item.rowNumber]);

  const totalImages = item.images.length;
  const safeIndex = currentImgIdx >= totalImages ? 0 : currentImgIdx;
  const activeImage = item.images[safeIndex] || {
    originalUrl: '',
    viewUrl: '',
    fallbackViewUrl: '',
    downloadUrl: '',
    fileId: null,
  };

  const displaySrc = useFallbackImg[safeIndex]
    ? activeImage.fallbackViewUrl
    : activeImage.viewUrl;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  return (
    <article
      data-testid={`board-card-${item.id}`}
      className="bg-slate-900/80 backdrop-blur-xl border border-amber-400/30 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-amber-400/55"
    >
      {/* 1. هيدر الكارت: شارة الصف + شارة ذهبية لرقم الحصة والفرع + شارة كحلية لليوم والتاريخ + شارة جديد اليوم */}
      <div className="p-5 sm:p-6 border-b border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/45 text-cyan-300 text-xs sm:text-sm font-black">
              <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>الصف {item.grade}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs sm:text-sm font-black shadow-sm">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{item.sessionAndBranch}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-400/35 text-cyan-200 text-xs sm:text-sm font-bold">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{item.dateLabel}</span>
            </span>
          </div>

          {isFirstNewest && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-l from-emerald-500 to-teal-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>جديد اليوم ✨</span>
            </span>
          )}
        </div>

        <h3 className="text-xl font-black text-white leading-snug">
          {item.lessonTitle}
        </h3>
      </div>

      {/* 2. معرض صور السبورة التفاعلي */}
      <div className="relative bg-slate-950/90 border-b border-white/10 group">
        <div
          onClick={() => onOpenLightbox(item, safeIndex)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenLightbox(item, safeIndex);
            }
          }}
          aria-label={`تكبير سبورة درس ${item.lessonTitle}`}
          className="relative w-full aspect-[16/10] sm:aspect-[16/9] overflow-hidden cursor-zoom-in flex items-center justify-center bg-[#06101E]"
        >
          {displaySrc ? (
            <img
              src={displaySrc}
              alt={`${item.lessonTitle} - صورة ${safeIndex + 1}`}
              referrerPolicy="no-referrer"
              onError={() => {
                if (
                  !useFallbackImg[safeIndex] &&
                  activeImage.fallbackViewUrl !== activeImage.viewUrl
                ) {
                  setUseFallbackImg((prev) => ({ ...prev, [safeIndex]: true }));
                }
              }}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.015]"
            />
          ) : (
            <div className="text-slate-400 text-sm font-bold flex flex-col items-center gap-2">
              <Camera className="w-8 h-8 text-amber-400/60" />
              <span>لا توجد صورة مرفقة لهذه الحصة</span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 group-hover:border-amber-400/50 transition-all pointer-events-none">
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            <span>اضغط على السبورة للتكبير والقراءة الواضحة</span>
          </div>

          {totalImages > 1 && (
            <div className="absolute top-3 right-3 px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-amber-400/45 text-amber-300 text-xs font-black shadow-lg">
              صورة {safeIndex + 1} من {totalImages}
            </div>
          )}
        </div>

        {totalImages > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label="الصورة السابقة"
              className="absolute top-1/2 -translate-y-1/2 right-3 w-10 h-10 rounded-2xl bg-slate-950/85 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 hover:border-amber-300 flex items-center justify-center shadow-xl cursor-pointer transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              aria-label="الصورة التالية"
              className="absolute top-1/2 -translate-y-1/2 left-3 w-10 h-10 rounded-2xl bg-slate-950/85 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 hover:border-amber-300 flex items-center justify-center shadow-xl cursor-pointer transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950/95 border-t border-white/10">
              {item.images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentImgIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition-all ${
                    safeIndex === idx
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  سبورة {idx + 1}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. صندوق الواجب والملاحظات + أي خانات إضافية جديدة في الشيت + أزرار التحكم أسفل الكارت */}
      <div className="p-5 sm:p-6 space-y-5">
        {item.homeworkAndNotes && (
          <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-500/15 via-slate-950/80 to-slate-950/90 border border-amber-400/35 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-right">
              <div className="text-xs font-black text-amber-300">
                الواجب المطلوب / ملاحظات الحصة:
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed">
                {item.homeworkAndNotes}
              </p>
            </div>
          </div>
        )}

        {/* عرض أي خانات أو أعمدة إضافية جديدة مضافة في شيت السبورة */}
        {item.extraFields && item.extraFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.extraFields.map((field, fIdx) => {
              const isLink = /^https?:\/\//i.test(field.value);
              return (
                <div
                  key={`${field.title}-${fIdx}`}
                  className="p-3.5 rounded-2xl bg-slate-950/85 border border-cyan-400/30 space-y-1 text-right"
                >
                  <div className="text-[11px] font-black text-cyan-300">
                    {field.title}:
                  </div>
                  {isLink ? (
                    <a
                      href={field.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm font-black text-amber-300 hover:underline break-all inline-block"
                    >
                      فتح الرابط المرفق ←
                    </a>
                  ) : (
                    <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                      {field.value}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() =>
              triggerBoardImageDownload(activeImage, item.lessonTitle, safeIndex + 1)
            }
            className="py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>⬇️ تحميل السبورة</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenLightbox(item, safeIndex)}
            className="py-3 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 hover:border-amber-300 text-amber-200 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Maximize2 className="w-4 h-4 text-amber-300 shrink-0" />
            <span>🔍 تكبير الشاشة</span>
          </button>

          <a
            href={buildBoardQuestionWhatsAppUrl(student, item)}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-4 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>💬 اسأل المستر في هذه الحصة</span>
          </a>
        </div>
      </div>
    </article>
  );
};

export const ClassroomBoardArchive: React.FC<ClassroomBoardArchiveProps> = ({
  activeStudent,
  availableGrades,
  isLoadingStudent = false,
  errorMessage = null,
  onLookupStudent,
  onSwitchStudent,
}) => {
  const [allBoards, setAllBoards] = useState<BoardLessonItem[]>([]);
  const [isFetchingBoards, setIsFetchingBoards] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');

  // 1. اختيار المرحلة الدراسية (ثلاث بطاقات: الابتدائية / الإعدادية / الثانوية)
  const [selectedStage, setSelectedStage] = useState<StageId | null>(null);
  // 2. اختيار الصف الدراسي داخل المرحلة
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  // 3. إدخال كود الطالب للتحقق منه في شيت الدرجات
  const [studentCodeInput, setStudentCodeInput] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  // 4. اختيار الحصة والدرس من الجدول لفتح السبورة
  const [selectedLessonKey, setSelectedLessonKey] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<BranchFilter>('الكل');

  // حالة نافذة التكبير ملء الشاشة (Full-Screen Lightbox Zoom & Pan)
  const [lightboxItem, setLightboxItem] = useState<BoardLessonItem | null>(null);
  const [lightboxImgIdx, setLightboxImgIdx] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isPollingBoardsRef = React.useRef<boolean>(false);
  const lastBoardsSerializedRef = React.useRef<string>('');

  const loadLiveBoardsFromSheet = useCallback(async (showSpinner = true) => {
    if (isPollingBoardsRef.current && !showSpinner) return;
    isPollingBoardsRef.current = true;
    if (showSpinner) setIsFetchingBoards(true);
    try {
      const liveItems = await fetchAllLiveBoardsFromSheet();
      const serialized = JSON.stringify(liveItems);
      if (serialized !== lastBoardsSerializedRef.current || showSpinner) {
        lastBoardsSerializedRef.current = serialized;
        setAllBoards(liveItems);
      }
      const now = new Date();
      setLastUpdatedTime(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } finally {
      isPollingBoardsRef.current = false;
      if (showSpinner) setIsFetchingBoards(false);
    }
  }, []);

  // الجلب الفوري عند فتح القسم + تحديث تلقائي حي كل 8 ثوانٍ وعند التركيز على النافذة لمتابعة الشيت لحظياً بدون تجميد الصفحة
  useEffect(() => {
    loadLiveBoardsFromSheet(true);

    const intervalId = window.setInterval(() => {
      loadLiveBoardsFromSheet(false);
    }, 8000);

    const handleFocus = () => {
      loadLiveBoardsFromSheet(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadLiveBoardsFromSheet]);

  // الصفوف المتاحة داخل المرحلة المختارة
  const gradesForCurrentStage = useMemo(() => {
    if (!selectedStage) return [];
    const matched = availableGrades.filter((g) => getStageForGrade(g) === selectedStage);
    if (matched.length > 0) return matched;
    const fallbackStage = STAGES.find((s) => s.id === selectedStage);
    return fallbackStage ? fallbackStage.grades : [];
  }, [availableGrades, selectedStage]);

  // اختيار المرحلة الدراسية من البطاقات الثلاث
  const handleStageCardSelect = (stageId: StageId) => {
    setSelectedStage(stageId);
    setLocalError(null);
    setStudentCodeInput('');
    setSelectedLessonKey(null);
    const stageGrades = availableGrades.filter((g) => getStageForGrade(g) === stageId);
    if (stageGrades.length > 0) {
      setSelectedGrade(stageGrades[0]);
    } else {
      const fallback = STAGES.find((s) => s.id === stageId);
      setSelectedGrade(fallback?.grades[0] || '');
    }
  };

  // التحقق من كود الطالب في شيت الدرجات
  const handleVerifyStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = studentCodeInput.trim();
    if (!selectedGrade) {
      setLocalError('يرجى اختيار الصف الدراسي أولاً.');
      return;
    }
    if (!cleanCode) {
      setLocalError('يرجى إدخال كود الطالب المسجل في شيت الدرجات.');
      return;
    }
    setLocalError(null);
    setSelectedLessonKey(null);
    if (onLookupStudent) {
      await onLookupStudent(selectedGrade, cleanCode);
    }
  };

  // إعادة التعيين للعودة إلى البطاقات الثلاث
  const handleResetToStages = () => {
    setSelectedStage(null);
    setSelectedGrade('');
    setStudentCodeInput('');
    setLocalError(null);
    setSelectedLessonKey(null);
    if (onSwitchStudent) {
      onSwitchStudent();
    }
  };

  // حصص الصف الدراسي للطالب الذي تم التحقق من كوده من شيت الدرجات
  const verifiedGrade = activeStudent?.grade || '';

  const gradeBoards = useMemo(() => {
    if (!verifiedGrade) return [];
    const normalize = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    return allBoards.filter((item) => {
      const matchesGrade =
        item.grade === verifiedGrade ||
        normalize(item.grade) === normalize(verifiedGrade);

      const normalizedBranchTarget = normalize(selectedBranch);
      const normalizedItemBranch = normalize(
        `${item.branchCategory} ${item.sessionAndBranch} ${item.lessonTitle}`
      );
      const matchesBranch =
        selectedBranch === 'الكل' || normalizedItemBranch.includes(normalizedBranchTarget);

      const cleanSearch = searchQuery.trim().toLowerCase();
      if (!cleanSearch) return matchesGrade && matchesBranch;

      const extraText = (item.extraFields || [])
        .map((f) => `${f.title} ${f.value}`)
        .join(' ');
      const haystack = `${item.lessonTitle} ${item.sessionAndBranch} ${item.dateLabel} ${item.homeworkAndNotes} ${extraText}`.toLowerCase();
      return matchesGrade && matchesBranch && haystack.includes(cleanSearch);
    });
  }, [allBoards, verifiedGrade, selectedBranch, searchQuery]);

  // استخراج عناوين أي أعمدة إضافية جديدة مضافة في شيت السبورة لعرضها كأعمدة في الجدول
  const extraColumnTitles = useMemo(() => {
    const titlesSet = new Set<string>();
    for (const b of gradeBoards) {
      for (const f of b.extraFields || []) {
        if (f.title) titlesSet.add(f.title);
      }
    }
    return Array.from(titlesSet);
  }, [gradeBoards]);

  const getLessonUniqueKey = (item: BoardLessonItem) =>
    `${item.grade}-${item.sessionAndBranch}-${item.lessonTitle}`;

  // الحصة المختارة حالياً لعرض سبورتها
  const activeLesson = useMemo(() => {
    if (!selectedLessonKey) return null;
    return (
      gradeBoards.find((b) => getLessonUniqueKey(b) === selectedLessonKey) ||
      allBoards.find((b) => getLessonUniqueKey(b) === selectedLessonKey) ||
      null
    );
  }, [gradeBoards, allBoards, selectedLessonKey]);

  const handleOpenLightbox = (item: BoardLessonItem, initialIndex: number) => {
    setLightboxItem(item);
    setLightboxImgIdx(initialIndex);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCloseLightbox = () => {
    setLightboxItem(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // نافذة التكبير ملء الشاشة (Full-Screen Lightbox Zoom) عبر Portal
  const lightboxModal =
    lightboxItem && typeof document !== 'undefined'
      ? createPortal(
          <div
            dir="rtl"
            className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between select-none no-print font-['Cairo',sans-serif]"
            role="dialog"
            aria-modal="true"
            aria-label={`تكبير سبورة ${lightboxItem.lessonTitle}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-white/10 z-20">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/45 text-amber-300 text-xs font-black">
                  {lightboxItem.sessionAndBranch}
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    {lightboxItem.lessonTitle}
                  </h4>
                  <p className="text-[11px] font-bold text-slate-400">
                    الصف {lightboxItem.grade} · {lightboxItem.dateLabel}
                    {lightboxItem.images.length > 1
                      ? ` · صورة ${lightboxImgIdx + 1} من ${lightboxItem.images.length}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 1}
                  title="تصغير"
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="إعادة ضبط الحجم"
                  className="px-3 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-black flex items-center gap-1 border border-white/15 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{Math.round(zoomScale * 100)}%</span>
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  title="تكبير"
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {lightboxItem.images[lightboxImgIdx] && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerBoardImageDownload(
                        lightboxItem.images[lightboxImgIdx],
                        lightboxItem.lessonTitle,
                        lightboxImgIdx + 1
                      )
                    }
                    className="px-3.5 h-9 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">تحميل السبورة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseLightbox}
                  aria-label="إغلاق"
                  className="w-9 h-9 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white flex items-center justify-center border border-rose-400/40 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              className={`relative flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-6 ${
                zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
              onMouseDown={(e) => {
                if (zoomScale <= 1) return;
                setIsDragging(true);
                setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
              }}
              onMouseMove={(e) => {
                if (!isDragging || zoomScale <= 1) return;
                setPanOffset({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y,
                });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (zoomScale <= 1 || e.touches.length !== 1) return;
                const touch = e.touches[0];
                setIsDragging(true);
                setDragStart({
                  x: touch.clientX - panOffset.x,
                  y: touch.clientY - panOffset.y,
                });
              }}
              onTouchMove={(e) => {
                if (!isDragging || zoomScale <= 1 || e.touches.length !== 1) return;
                const touch = e.touches[0];
                setPanOffset({
                  x: touch.clientX - dragStart.x,
                  y: touch.clientY - dragStart.y,
                });
              }}
              onTouchEnd={() => setIsDragging(false)}
            >
              {lightboxItem.images[lightboxImgIdx] && (
                <img
                  src={lightboxItem.images[lightboxImgIdx].viewUrl}
                  alt={lightboxItem.lessonTitle}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  }}
                  className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
                />
              )}

              {lightboxItem.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLightboxImgIdx((prev) =>
                        prev === 0 ? lightboxItem.images.length - 1 : prev - 1
                      );
                      handleResetZoom();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-slate-900/90 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 flex items-center justify-center shadow-2xl cursor-pointer z-20"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLightboxImgIdx((prev) =>
                        prev === lightboxItem.images.length - 1 ? 0 : prev + 1
                      );
                      handleResetZoom();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-slate-900/90 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 flex items-center justify-center shadow-2xl cursor-pointer z-20"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-900/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-300 z-20">
              <div className="flex items-center gap-2 text-amber-300">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>الواجب: {lightboxItem.homeworkAndNotes}</span>
              </div>
              <div className="text-slate-400">
                استخدم أزرار (+) و (-) للتكبير ثم اسحب الصورة بإصبعك لقراءة المعادلات بوضوح
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const displayedError = localError || errorMessage;

  return (
    <div className="space-y-6">
      {/* ================= الحالة 1: لم يتم تسجيل دخول الطالب بعد (اختيار المرحلة -> الصف -> كود الطالب) ================= */}
      {!activeStudent ? (
        !selectedStage ? (
          /* 1. ثلاث بطاقات أولاً يختار منها المرحلة الدراسية */
          <section className="space-y-5">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-400/35 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/45 text-amber-300 text-xs font-black">
                  <Camera className="w-3.5 h-3.5" />
                  <span>الخطوة 1: اختر المرحلة الدراسية</span>
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  📸 سبورة الحصص والملخصات
                </h2>
                <p className="text-xs sm:text-sm font-bold text-slate-300">
                  اختر المرحلة الدراسية أولاً، ثم اختر الصف وأدخل كود الطالب لعرض جدول الحصص والسبورات
                </p>
              </div>
            </div>

            {/* البطاقات الثلاث للمراحل الدراسية بحجم مدمج وأنيق */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STAGE_CARDS.map((stage) => {
                const stageGrades = availableGrades.filter(
                  (g) => getStageForGrade(g) === stage.id
                );

                return (
                  <button
                    key={stage.id}
                    type="button"
                    data-testid={`board-stage-card-${stage.id}`}
                    onClick={() => handleStageCardSelect(stage.id)}
                    className="group relative overflow-hidden rounded-2xl bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl border border-white/15 hover:border-amber-400/60 p-4 text-right transition-all duration-200 shadow-lg hover:scale-[1.01] cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${stage.accentGradient} opacity-65 group-hover:opacity-100 transition-opacity pointer-events-none`}
                    />

                    <div className="relative z-10 flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-md ${stage.iconBg}`}
                      >
                        {renderMathStageIcon(stage.icon)}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors truncate">
                          {stage.fullTitle}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-300 truncate">
                          {stage.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-white/10 text-[11px] font-black text-amber-300">
                        {stageGrades.length} صفوف
                      </span>
                      <ChevronLeft className="w-4 h-4 text-amber-300 transition-transform group-hover:-translate-x-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          /* 2. اختيار الصف المتاح داخل المرحلة المختارة + إدخال كود الطالب والتحقق منه في شيت الدرجات */
          <form
            onSubmit={handleVerifyStudentSubmit}
            className="bg-slate-900/80 backdrop-blur-xl border border-amber-400/35 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <GraduationCap className="w-4 h-4" />
                  <span>
                    {STAGE_CARDS.find((s) => s.id === selectedStage)?.fullTitle}
                  </span>
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  اختر الصف الدراسي ثم سجل كود الطالب
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedStage(null);
                  setSelectedGrade('');
                  setLocalError(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span>تغيير المرحلة</span>
              </button>
            </div>

            {/* الصفوف المتاحة في هذه المرحلة بحجم مدمج */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-cyan-300">
                1. اختر الصف الدراسي المتاح:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {gradesForCurrentStage.map((gradeItem) => {
                  const isSelected = selectedGrade === gradeItem;
                  return (
                    <button
                      key={gradeItem}
                      type="button"
                      data-testid={`board-grade-option-${gradeItem}`}
                      onClick={() => {
                        setSelectedGrade(gradeItem);
                        setLocalError(null);
                      }}
                      className={`py-2.5 px-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-gradient-to-l from-amber-500 to-yellow-500 text-slate-950 border-amber-300 font-black shadow-md'
                          : 'bg-slate-950/85 hover:bg-slate-900 text-white border-white/15 hover:border-amber-400/50 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-slate-950' : 'text-amber-400'
                          }`}
                        />
                        <span className="text-xs sm:text-sm">الصف {gradeItem}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* إدخال كود الطالب للتحقق منه من شيت الدرجات */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <label
                htmlFor="board-student-code-input"
                className="block text-xs sm:text-sm font-black text-amber-300"
              >
                2. سجل كود الطالب (يتم التحقق منه من شيت الدرجات):
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    id="board-student-code-input"
                    data-testid="board-student-code-input"
                    type="text"
                    inputMode="numeric"
                    value={studentCodeInput}
                    onChange={(e) => {
                      setStudentCodeInput(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="اكتب كود الطالب هنا..."
                    className="bg-slate-950/90 border-2 border-white/15 text-white placeholder:text-slate-400 rounded-2xl p-4 pr-12 w-full font-black text-sm sm:text-base focus:outline-none focus:border-amber-400 transition-all"
                  />
                  <Barcode className="w-5 h-5 text-amber-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingStudent}
                  data-testid="board-verify-code-btn"
                  className="px-7 py-4 rounded-2xl bg-gradient-to-l from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isLoadingStudent
                      ? 'جاري التحقق من الكود...'
                      : 'دخول وعرض جدول الحصص'}
                  </span>
                </button>
              </div>

              {displayedError && (
                <div
                  role="alert"
                  className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/20 border border-rose-400/50 text-rose-100 text-xs sm:text-sm font-black text-right"
                >
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{displayedError}</span>
                </div>
              )}
            </div>
          </form>
        )
      ) : !activeLesson ? (
        /* ================= الحالة 2: بعد التحقق من كود الطالب -> عرض الحصص والسبورات المتاحة كـ جدول ================= */
        <section className="bg-slate-900/80 backdrop-blur-xl border border-amber-400/35 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
          {/* هيدر الجدول وبيانات الطالب المسجل */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>
                    الطالب: {activeStudent.name} (كود: {activeStudent.id})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>الصف {activeStudent.grade}</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">
                📋 جدول الحصص والسبورات المتاحة — الصف {activeStudent.grade}
              </h2>
              <p className="text-xs font-bold text-slate-300">
                اختر الحصة والدرس من الجدول أدناه لتفتح لك السبورة والملخص الخاص بها
                {lastUpdatedTime ? ` (آخر تحديث حي: ${lastUpdatedTime})` : ''}
              </p>
            </div>

            <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="refresh-boards-btn"
                onClick={() => loadLiveBoardsFromSheet(true)}
                disabled={isFetchingBoards}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-l from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingBoards ? 'animate-spin' : ''}`} />
                <span>🔄 تحديث السبورات</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStages}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span>تغيير الطالب / المرحلة</span>
              </button>
            </div>
          </div>

          {/* شريط البحث وتصفية الفرع */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في الجدول برقم الحصة أو اسم الدرس..."
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-slate-950/90 border border-white/15 focus:border-amber-400 text-white text-xs sm:text-sm font-bold outline-none transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/85 p-1.5 rounded-2xl border border-white/10">
              {(['الكل', 'حساب', 'جبر', 'هندسة', 'حساب مثلثات'] as BranchFilter[]).map(
                (branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setSelectedBranch(branch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      selectedBranch === branch
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {branch}
                  </button>
                )
              )}
            </div>
          </div>

          {/* جدول الحصص والسبورات المتاحة */}
          {isFetchingBoards && allBoards.length === 0 ? (
            <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-10 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 mx-auto animate-spin" />
              <div className="text-sm sm:text-base font-black text-white">
                جاري جلب جدول الحصص والسبورات من الشيت...
              </div>
            </div>
          ) : gradeBoards.length === 0 ? (
            <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-8 text-center space-y-2">
              <Camera className="w-9 h-9 text-amber-400 mx-auto" />
              <div className="text-base font-black text-white">
                لا توجد حصص مسجلة في الشيت للصف {activeStudent.grade} حالياً
              </div>
              <p className="text-xs font-bold text-slate-400">
                بمجرد إضافة الحصة في ملف Google Sheet ستظهر في هذا الجدول تلقائياً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/15 bg-slate-950/85 shadow-inner">
              <table
                data-testid="boards-lessons-table"
                className="w-full text-right border-collapse"
              >
                <thead>
                  <tr className="bg-slate-900/95 border-b border-white/15 text-amber-300 text-xs sm:text-sm font-black">
                    <th className="py-3.5 px-4 whitespace-nowrap">#</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">الحصة والفرع</th>
                    <th className="py-3.5 px-4">اسم الدرس</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">اليوم والتاريخ</th>
                    <th className="py-3.5 px-4 hidden md:table-cell">الواجب / ملاحظات</th>
                    {extraColumnTitles.map((colTitle) => (
                      <th key={colTitle} className="py-3.5 px-4 whitespace-nowrap">
                        {colTitle}
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">السبورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-xs sm:text-sm">
                  {gradeBoards.map((lesson, idx) => (
                    <tr
                      key={getLessonUniqueKey(lesson)}
                      onClick={() => setSelectedLessonKey(getLessonUniqueKey(lesson))}
                      className="hover:bg-amber-500/10 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono-num font-black text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                            {lesson.sessionAndBranch}
                          </span>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                              جديد ✨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-black text-white group-hover:text-amber-300 transition-colors">
                        {lesson.lessonTitle}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-cyan-200">
                        {lesson.dateLabel}
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell font-bold text-slate-300 max-w-xs truncate">
                        {lesson.homeworkAndNotes || '—'}
                      </td>
                      {extraColumnTitles.map((colTitle) => {
                        const matchedField = (lesson.extraFields || []).find(
                          (f) => f.title === colTitle
                        );
                        return (
                          <td
                            key={colTitle}
                            className="py-3.5 px-4 font-bold text-emerald-200 max-w-xs truncate"
                          >
                            {matchedField ? matchedField.value : '—'}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          data-testid={`open-board-row-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLessonKey(getLessonUniqueKey(lesson));
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-l from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>فتح السبورة</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* ================= الحالة 3: بعد اختيار الحصة والدرس من الجدول -> تفتح السبورة كاملة ================= */
        <div className="space-y-4">
          <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLessonKey(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لجدول الحصص والسبورات</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStages}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-all"
              >
                تغيير الطالب / المرحلة
              </button>
            </div>

            {gradeBoards.length > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <span>تبديل الدرس:</span>
                <select
                  value={getLessonUniqueKey(activeLesson)}
                  onChange={(e) => setSelectedLessonKey(e.target.value)}
                  aria-label="تبديل الدرس"
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-400/40 text-white text-xs font-black outline-none cursor-pointer"
                >
                  {gradeBoards.map((b) => (
                    <option key={getLessonUniqueKey(b)} value={getLessonUniqueKey(b)}>
                      {b.sessionAndBranch} — {b.lessonTitle}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <BoardCard
            item={activeLesson}
            isFirstNewest={
              gradeBoards[0]
                ? getLessonUniqueKey(gradeBoards[0]) === getLessonUniqueKey(activeLesson)
                : Boolean(activeLesson.isLatest)
            }
            student={activeStudent}
            onOpenLightbox={handleOpenLightbox}
          />
        </div>
      )}

      {lightboxModal}
    </div>
  );
};
