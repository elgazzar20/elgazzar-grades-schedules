import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Barcode,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Facebook,
  GraduationCap,
  Home,
  Instagram,
  Layers,
  MapPin,
  MessageCircle,
  MonitorPlay,
  PhoneCall,
  Radio,
  Send,
  Share2,
  Sparkles,
  User,
  Video,
  Youtube,
} from 'lucide-react';
import {
  ALL_DEFAULT_GRADES,
  MOCK_DATABASE,
  StudentRecord,
} from './data/mockDatabase';
import {
  STAGES,
  StageId,
  TEACHER_PHONE_LOCAL,
  buildGeneralWhatsAppUrl,
  evaluateStudentScores,
  getStageForGrade,
} from './utils/grading';
import { ConfettiOverlay } from './components/ConfettiOverlay';
import { StudentDashboard } from './components/StudentDashboard';
import {
  DEFAULT_STAGE_SCHEDULES,
  GradeScheduleGroup,
  StageSchedulesMap,
  fetchLiveStudentFromGoogleSheets,
  subscribeToRealtimeScheduleUpdates,
  subscribeToRealtimeStudentUpdates,
} from './services/sheetsService';

const HERO_BG_IMAGE = '/10010.png';
const HERO_BG_EXTERNAL = 'https://i.postimg.cc/wTdZfHFJ/10010.png';
const AVATAR_IMAGE = '/assets/aistudio/Picsart_26-09-19_10-18-54-766_95668d91.jpg';

type PageTab = 'home' | 'schedule' | 'contact';

function formatStageScheduleSummary(groups: GradeScheduleGroup[]): string {
  const totalSessions = groups.reduce((acc, g) => acc + g.sessions.length, 0);
  if (totalSessions === 0) return 'لا توجد مجموعات مسجلة حالياً';

  const shortGrades = groups
    .map((g) => g.gradeTitle.replace(/^الصف\s+/, '').trim())
    .join(' · ');

  const countLabel =
    totalSessions === 1
      ? 'مجموعة واحدة'
      : totalSessions === 2
      ? 'مجموعتان'
      : totalSessions <= 10
      ? `${totalSessions} مجموعات`
      : `${totalSessions} مجموعة`;

  return `${countLabel} (${shortGrades})`;
}

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

export default function App() {
  const [activePage, setActivePage] = useState<PageTab>('home');
  const [availableGrades] = useState<string[]>(ALL_DEFAULT_GRADES);
  const [selectedStage, setSelectedStage] = useState<StageId | null>(null);
  const [selectedScheduleStage, setSelectedScheduleStage] = useState<StageId | null>(null);
  const [stageSchedules, setStageSchedules] = useState<StageSchedulesMap>(DEFAULT_STAGE_SCHEDULES);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);

  // اشتراك لحظي (Real-time) عبر الشيت الخارجي للمواعيد (1m5y12DU0jgtBsShGVihBuzlk3pTVhKezIwGtTnV0x9A) لتحديث جدول المواعيد تلقائياً
  useEffect(() => {
    document.title = 'مستر محمد الجزار';
    const unsubscribeSchedule = subscribeToRealtimeScheduleUpdates((liveSchedules) => {
      setStageSchedules(liveSchedules);
    });
    return () => unsubscribeSchedule();
  }, []);

  // اشتراك لحظي (Real-time) عبر Firebase Firestore والشيت الخارجي لتحديث الشهادة تلقائياً فور تعديل الشيت
  useEffect(() => {
    if (!activeStudent) return;
    const unsubscribe = subscribeToRealtimeStudentUpdates(
      activeStudent.grade,
      activeStudent.id,
      (updatedRecord) => {
        setActiveStudent(updatedRecord);
      }
    );
    return () => unsubscribe();
  }, [activeStudent?.grade, activeStudent?.id]);

  const gradesForCurrentStage = useMemo(() => {
    if (!selectedStage) return [];
    const matched = availableGrades.filter((g) => getStageForGrade(g) === selectedStage);
    if (matched.length > 0) return matched;
    const fallbackStage = STAGES.find((s) => s.id === selectedStage);
    return fallbackStage ? fallbackStage.grades : [];
  }, [availableGrades, selectedStage]);

  const handleStageSelect = (stageId: StageId) => {
    setSelectedStage(stageId);
    setErrorMessage(null);
    setActiveStudent(null);
    setStudentIdInput('');
    const stageGrades = availableGrades.filter((g) => getStageForGrade(g) === stageId);
    if (stageGrades.length > 0) {
      setSelectedGrade(stageGrades[0]);
    }
  };

  const handleBackToStages = () => {
    setSelectedStage(null);
    setSelectedGrade('');
    setStudentIdInput('');
    setErrorMessage(null);
    setActiveStudent(null);
  };

  const executeStudentLookup = async (gradeToSearch: string, codeToSearch: string) => {
    const cleanId = codeToSearch.trim();
    if (!gradeToSearch) {
      setErrorMessage('يرجى اختيار الصف الدراسي أولاً.');
      return;
    }
    if (!cleanId) {
      setErrorMessage('يرجى كتابة كود الطالب لعرض الشهادة.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. محاولة القراءة الحية المباشرة من Google Sheets (سواء عبر API أو رابط الشيت العام أو Apps Script)
      const liveResult = await fetchLiveStudentFromGoogleSheets(gradeToSearch, cleanId);
      if (liveResult.handled) {
        if (liveResult.student) {
          setActiveStudent(liveResult.student);
          setErrorMessage(null);
        } else {
          setActiveStudent(null);
          setErrorMessage(`الكود الآتي (${cleanId}) غير مسجل`);
        }
        setIsLoading(false);
        return;
      }

      // 2. البيانات الافتراضية المدمجة في حال عدم ربط شيت خارجي بعد
      const gradeRecords = MOCK_DATABASE[gradeToSearch] || [];
      const found = gradeRecords.find((item) => item.id === cleanId);

      if (found) {
        setActiveStudent(found);
        setErrorMessage(null);
      } else {
        setErrorMessage(`الكود الآتي (${cleanId}) غير مسجل`);
        setActiveStudent(null);
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء جلب النتيجة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeStudentLookup(selectedGrade, studentIdInput);
  };

  const performanceSummary = useMemo(() => {
    if (!activeStudent) return null;
    return evaluateStudentScores(activeStudent.scores);
  }, [activeStudent]);

  return (
    <div
      dir="rtl"
      style={{
        backgroundImage: `url('${HERO_BG_IMAGE}'), url('${HERO_BG_EXTERNAL}')`,
      }}
      className="bg-cover bg-center bg-fixed min-h-screen relative text-white font-['Cairo',sans-serif] overflow-x-hidden selection:bg-cyan-400 selection:text-slate-950"
    >
      {/* طبقة تظليل هادئة تبرز جمال الخلفية والأقسام */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-b from-slate-950/55 via-slate-900/40 to-slate-950/75 z-0"
      />

      {/* مؤثرات الاحتفال عند تحقيق تقدير 90% فأكثر */}
      <ConfettiOverlay active={Boolean(performanceSummary?.badge.triggerConfetti)} />

      {/* 1. البار العلوي الثابت (Top Navigation Bar): الرئيسية · جدول المواعيد · روابط التواصل (بدون زر تواصل مباشر) */}
      <header className="sticky top-0 z-40 w-full bg-slate-950/70 backdrop-blur-xl border-b border-white/10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* هوية المعلم المختصرة في الهيدر */}
          <button
            type="button"
            onClick={() => {
              setActivePage('home');
              handleBackToStages();
            }}
            className="flex items-center gap-3 text-right cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl border-2 border-cyan-400/70 bg-slate-900 p-0.5 overflow-hidden shadow-md group-hover:border-emerald-400 transition-colors">
              {!avatarLoadError ? (
                <img
                  src={AVATAR_IMAGE}
                  alt="مستر محمد الجزار"
                  onError={() => setAvatarLoadError(true)}
                  className="w-full h-full object-cover object-top rounded-lg"
                />
              ) : (
                <User className="w-6 h-6 text-cyan-400 m-auto" />
              )}
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                مستر محمد الجزار
              </div>
              <div className="text-[11px] font-bold text-cyan-300/85">
                منصة الرياضيات · المرحلة الابتدائية والإعدادية والثانوية
              </div>
            </div>
          </button>

          {/* روابط الصفحات الثلاث في البار العلوي */}
          <nav
            aria-label="التنقل الرئيسي"
            className="flex items-center gap-1.5 bg-slate-900/85 p-1.5 rounded-2xl border border-white/10"
          >
            <button
              type="button"
              data-testid="nav-home"
              onClick={() => {
                setActivePage('home');
                handleBackToStages();
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activePage === 'home'
                  ? 'bg-gradient-to-l from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>

            <button
              type="button"
              data-testid="nav-schedule"
              onClick={() => {
                setActivePage('schedule');
                setSelectedScheduleStage(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activePage === 'schedule'
                  ? 'bg-gradient-to-l from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>جدول المواعيد</span>
            </button>

            <button
              type="button"
              data-testid="nav-contact"
              onClick={() => setActivePage('contact')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activePage === 'contact'
                  ? 'bg-gradient-to-l from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>روابط التواصل</span>
            </button>
          </nav>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* بانر ترحيبي مفتوح وأنيق يجمع صورة الأستاذ محمد الجزار وعنوان المنصة (يختفي عند فتح الشهادة لعدم تكرار الهيدر) */}
        {!(activePage === 'home' && activeStudent && performanceSummary) && (
          <section className="flex flex-col sm:flex-row items-center justify-between gap-5 bg-slate-900/65 backdrop-blur-xl border border-cyan-400/25 rounded-3xl p-5 sm:p-6 shadow-2xl no-print">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
              <div
                title="مستر محمد الجزار"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-cyan-400 ring-4 ring-cyan-400/15 bg-slate-900 p-1 overflow-hidden shadow-xl shrink-0"
              >
                {!avatarLoadError ? (
                  <img
                    src={AVATAR_IMAGE}
                    alt="مستر محمد الجزار"
                    onError={() => setAvatarLoadError(true)}
                    className="w-full h-full object-cover object-top rounded-xl"
                  />
                ) : (
                  <User className="w-12 h-12 text-cyan-400 m-auto" />
                )}
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-black">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>منصة المتفوقين في الرياضيات</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  مستر محمد الجزار
                </h1>
                <p className="text-slate-200 text-xs sm:text-sm font-bold">
                  خبير تدريس مادة الرياضيات للمراحل الابتدائية والإعدادية والثانوية
                </p>
              </div>
            </div>

            {/* بطاقة رقم التواصل السريع داخل الهيدر الترحيبي */}
            <a
              href={buildGeneralWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-950/75 hover:bg-slate-950 border border-emerald-400/35 hover:border-emerald-400 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold text-emerald-300">واتساب واستفسارات</div>
                <div dir="ltr" className="text-sm sm:text-base font-black text-white font-mono-num">
                  {TEACHER_PHONE_LOCAL}
                </div>
              </div>
            </a>
          </section>
        )}

        {/* التبديل بين الصفحات الثلاث (الرئيسية · جدول المواعيد · روابط التواصل) */}
        <AnimatePresence mode="wait">
          {activePage === 'home' && (
            <motion.div
              key="page-home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <AnimatePresence mode="wait">
                {/* 1. صفحة اختيار المرحلة الدراسية (تظهر فقط عند عدم اختيار مرحلة بعد) */}
                {!selectedStage ? (
                  <motion.section
                    key="view-select-stage"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.25 }}
                    className="bg-slate-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
                  >
                    <div className="text-center sm:text-right space-y-2">
                      <h2 className="text-lg sm:text-xl font-black text-white flex items-center justify-center sm:justify-start gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950 flex items-center justify-center text-sm font-black shadow-sm shrink-0">
                          1
                        </span>
                        <span>اختر المرحلة الدراسية للاستعلام عن الدرجات والحضور</span>
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
                        اضغط على المرحلة الدراسية الخاصة بالطالب للانتقال إلى صفحة اختيار الصف وإدخال الكود، لتظهر لك البيانات والدرجات والحضور والتقييمات بالتفصيل
                      </p>
                    </div>

                    <div
                      role="tablist"
                      aria-label="اختر المرحلة الدراسية"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                    >
                      {STAGE_CARDS.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          role="tab"
                          aria-selected={false}
                          data-testid={`stage-card-${stage.id}`}
                          onClick={() => handleStageSelect(stage.id)}
                          className="group relative p-6 rounded-3xl text-right transition-all cursor-pointer overflow-hidden border-2 bg-slate-950/65 hover:bg-gradient-to-br hover:from-cyan-500/25 hover:via-teal-600/20 hover:to-slate-900/90 border-white/15 hover:border-cyan-400 hover:shadow-[0_15px_35px_rgba(6,182,212,0.28)] hover:scale-[1.02] flex flex-col justify-between gap-5"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div
                              className={`w-13 h-13 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-105 ${stage.iconBg}`}
                            >
                              {stage.icon === 'primary' ? (
                                <BookOpen className="w-6 h-6" />
                              ) : stage.icon === 'prep' ? (
                                <Compass className="w-6 h-6" />
                              ) : (
                                <GraduationCap className="w-6 h-6" />
                              )}
                            </div>

                            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 group-hover:bg-cyan-400 group-hover:text-slate-950 transition-colors">
                              دخول المرحلة ←
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xl sm:text-2xl font-black text-white">
                              {stage.shortTitle}
                            </div>
                            <div className="text-xs font-bold text-slate-300">
                              {stage.subtitle}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.section>
                ) : !activeStudent || !performanceSummary ? (
                  /* 2. صفحة المرحلة المختارة (اختيار الصف الدراسي + كتابة كود الطالب) */
                  <motion.form
                    key={`view-stage-lookup-${selectedStage}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleFormSubmit}
                    className="bg-slate-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6"
                  >
                    {/* شريط علوي داخل صفحة المرحلة مع زر الرجوع لتغيير المرحلة */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs sm:text-sm font-black">
                          {STAGE_CARDS.find((s) => s.id === selectedStage)?.fullTitle}
                        </span>
                      </div>

                      <button
                        type="button"
                        data-testid="back-to-stages-btn"
                        onClick={handleBackToStages}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs sm:text-sm transition-all cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4 text-cyan-300" />
                        <span>تغيير المرحلة الدراسية</span>
                      </button>
                    </div>

                    {/* اختيار الصف الدراسي */}
                    <div className="space-y-3">
                      <label className="text-sm sm:text-base font-black text-white flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center text-sm font-black">
                          1
                        </span>
                        <span>اختر الصف الدراسي</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {gradesForCurrentStage.map((grade, idx) => {
                          const isGradeSelected = selectedGrade === grade;
                          const isLastOdd =
                            gradesForCurrentStage.length % 2 === 1 &&
                            idx === gradesForCurrentStage.length - 1;

                          return (
                            <button
                              key={grade}
                              type="button"
                              data-testid={`grade-box-${grade}`}
                              onClick={() => {
                                setSelectedGrade(grade);
                                if (errorMessage) setErrorMessage(null);
                              }}
                              className={`${
                                isLastOdd ? 'sm:col-span-2' : ''
                              } p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isGradeSelected
                                  ? 'bg-gradient-to-l from-cyan-500/25 via-teal-500/20 to-emerald-500/20 border-cyan-400 text-white shadow-[0_8px_20px_rgba(6,182,212,0.2)]'
                                  : 'bg-slate-950/60 hover:bg-slate-950/85 border-white/10 hover:border-cyan-400/40 text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isGradeSelected
                                      ? 'bg-cyan-400 text-slate-950'
                                      : 'bg-white/10 text-cyan-300'
                                  }`}
                                >
                                  <Layers className="w-4 h-4" />
                                </div>
                                <span className="font-black text-sm sm:text-base text-white whitespace-nowrap truncate">
                                  الصف {grade}
                                </span>
                              </div>

                              {isGradeSelected ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-cyan-400/20 border border-cyan-300/50 text-cyan-200 text-xs font-black shrink-0">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                                  <span>مُختار</span>
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 shrink-0">
                                  اختيار
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* كتابة كود الطالب وعرض الشهادة */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <label
                        htmlFor="student-code-input"
                        className="text-sm sm:text-base font-black text-white flex items-center gap-2.5"
                      >
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 flex items-center justify-center text-sm font-black">
                          2
                        </span>
                        <span>اكتب كود الطالب في «الصف {selectedGrade}»</span>
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <input
                            id="student-code-input"
                            data-testid="student-code-input"
                            type="text"
                            inputMode="numeric"
                            value={studentIdInput}
                            onChange={(e) => {
                              setStudentIdInput(e.target.value);
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="اكتب كود الطالب هنا..."
                            className="bg-slate-950/85 border-2 border-white/15 text-white placeholder:text-slate-400 rounded-2xl p-4 pr-12 w-full font-black text-sm sm:text-base focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25 transition-all"
                          />
                          <Barcode className="w-5 h-5 text-cyan-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          data-testid="search-submit-btn"
                          className="px-7 py-4 rounded-2xl bg-gradient-to-l from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-base shadow-[0_10px_25px_rgba(6,182,212,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Award className="w-5 h-5 stroke-[2.5]" />
                          <span>{isLoading ? 'جاري البحث...' : 'عرض الشهادة'}</span>
                        </button>
                      </div>

                      {errorMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          role="alert"
                          data-testid="search-error-alert"
                          className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/20 border border-rose-400/50 text-rose-100 text-sm font-black text-right"
                        >
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          <span>{errorMessage}</span>
                        </motion.div>
                      )}
                    </div>
                  </motion.form>
                ) : (
                  /* 3. صفحة عرض الشهادة */
                  <motion.div
                    key="view-student-certificate"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.25 }}
                  >
                    <StudentDashboard
                      key="student-result"
                      student={activeStudent}
                      summary={performanceSummary}
                      onResetSearch={() => {
                        setActiveStudent(null);
                        setErrorMessage(null);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* الصفحة الثانية: جدول المواعيد (يختار المرحلة ثم يدخل لصفحة جدول المرحلة المنسق) */}
          {activePage === 'schedule' && (
            <motion.div
              key="page-schedule"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              data-testid="schedule-page"
              className="space-y-6 text-right"
            >
              <AnimatePresence mode="wait">
                {!selectedScheduleStage ? (
                  /* 1. صفحة اختيار المرحلة لعرض جدول مواعيدها */
                  <motion.section
                    key="schedule-select-stage"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.25 }}
                    className="bg-slate-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-black">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>مواعيد المجموعات الدراسية</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white">
                          اختر المرحلة الدراسية لعرض جدول المواعيد
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePage('home')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-black text-cyan-200 border border-white/15 cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>العودة للرئيسية</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {STAGE_CARDS.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          data-testid={`schedule-stage-card-${stage.id}`}
                          onClick={() => setSelectedScheduleStage(stage.id)}
                          className="group relative p-6 rounded-3xl text-right transition-all cursor-pointer overflow-hidden border-2 bg-slate-950/65 hover:bg-gradient-to-br hover:from-cyan-500/25 hover:via-teal-600/20 hover:to-slate-900/90 border-white/15 hover:border-cyan-400 hover:shadow-[0_15px_35px_rgba(6,182,212,0.28)] hover:scale-[1.02] flex flex-col justify-between gap-5"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div
                              className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-105 ${stage.iconBg}`}
                            >
                              <Calendar className="w-6 h-6" />
                            </div>

                            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 group-hover:bg-cyan-400 group-hover:text-slate-950 transition-colors">
                              عرض الجدول ←
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xl font-black text-white">
                              جدول {stage.shortTitle}
                            </div>
                            <div className="text-xs font-bold text-emerald-300">
                              {formatStageScheduleSummary(stageSchedules[stage.id] || [])}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.section>
                ) : (
                  /* 2. صفحة جدول المواعيد المنسق للمرحلة المختارة */
                  <motion.section
                    key={`schedule-detail-${selectedScheduleStage}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    data-testid={`schedule-detail-${selectedScheduleStage}`}
                    className="bg-slate-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
                  >
                    {/* شريط علوي مع زر الرجوع لاختيار مرحلة أخرى */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-black">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>مواعيد الحصص المعتمدة</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white">
                          جدول مواعيد{' '}
                          {STAGE_CARDS.find((s) => s.id === selectedScheduleStage)?.fullTitle}
                        </h2>
                      </div>

                      <button
                        type="button"
                        data-testid="back-to-schedule-stages-btn"
                        onClick={() => setSelectedScheduleStage(null)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-black text-white border border-white/15 cursor-pointer transition-all"
                      >
                        <ArrowRight className="w-4 h-4 text-cyan-300" />
                        <span>تغيير المرحلة</span>
                      </button>
                    </div>

                    {/* بطاقات وجداول الصفوف داخل المرحلة المختارة */}
                    <div className="space-y-5">
                      {(stageSchedules[selectedScheduleStage] || []).map((gradeBlock) => (
                        <div
                          key={gradeBlock.gradeTitle}
                          className="bg-slate-950/70 border border-cyan-400/25 rounded-2xl overflow-hidden shadow-lg"
                        >
                          {/* رأس الصف الدراسي */}
                          <div className="bg-gradient-to-l from-cyan-500/20 via-teal-500/15 to-slate-900 px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center font-black">
                                <GraduationCap className="w-5 h-5" />
                              </div>
                              <h3 className="text-base sm:text-lg font-black text-white">
                                {gradeBlock.gradeTitle}
                              </h3>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-white/10 text-cyan-200 text-xs font-black">
                              {gradeBlock.sessions.length === 1
                                ? 'مجموعة واحدة'
                                : `${gradeBlock.sessions.length} مجموعات`}
                            </span>
                          </div>

                          {/* صفوف المواعيد داخل الصف الدراسي */}
                          <div className="divide-y divide-white/10">
                            {gradeBlock.sessions.map((session, idx) => (
                              <div
                                key={`${gradeBlock.gradeTitle}-${idx}`}
                                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 flex items-center justify-center text-xs font-black shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-bold text-slate-300">
                                        {session.groupLabel}
                                      </span>
                                      {session.statusNote && (
                                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-black">
                                          {session.statusNote}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm sm:text-base font-black text-white flex items-center gap-2 mt-1">
                                      <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                                      <span>{session.days}</span>
                                    </div>
                                  </div>
                                </div>

                                {session.time && (
                                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-500/20 to-cyan-500/20 border border-emerald-400/35 text-emerald-200 text-xs sm:text-sm font-black self-start sm:self-center">
                                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>{session.time}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* الصفحة الثالثة: روابط التواصل والمحتوى والمكان */}
          {activePage === 'contact' && (
            <motion.section
              key="page-contact"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              data-testid="contact-page"
              className="bg-slate-900/70 backdrop-blur-xl border border-cyan-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 text-right"
            >
              {/* رأس صفحة روابط التواصل */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-black">
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>القنوات والمنصات الرسمية</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    روابط التواصل والمحتوى — مستر محمد الجزار
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePage('home')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-black text-cyan-200 border border-white/15 cursor-pointer transition-all"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة للرئيسية</span>
                </button>
              </div>

              {/* القسم الأول: تواصل */}
              <div className="space-y-3.5">
                <h3 className="text-base sm:text-lg font-black text-cyan-300 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <span>تواصل</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* واتساب */}
                  <a
                    href="https://api.whatsapp.com/send/?phone=201009617278"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-emerald-500/20 hover:to-slate-950 border border-emerald-400/35 hover:border-emerald-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                        <MessageCircle className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">واتساب</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        تواصل معي مباشرة
                      </p>
                    </div>
                  </a>

                  {/* قناة الواتساب */}
                  <a
                    href="https://www.whatsapp.com/channel/0029Vb8MUHDGufIrGScOL22o"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-teal-500/20 hover:to-slate-950 border border-teal-400/35 hover:border-teal-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center group-hover:bg-teal-400 group-hover:text-slate-950 transition-colors">
                        <Radio className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-teal-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">قناة الواتساب</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        انضم لمتابعة أحدث المراجعات، ملخصات الشرح، والأخبار الهامة أولاً بأول
                      </p>
                    </div>
                  </a>

                  {/* تيليجرام */}
                  <a
                    href="https://t.me/MohamedElGazzar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-sky-500/20 hover:to-slate-950 border border-sky-400/35 hover:border-sky-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center group-hover:bg-sky-400 group-hover:text-slate-950 transition-colors">
                        <Send className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">تيليجرام</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        انضم لقناتنا على التيليجرام
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              {/* القسم الثاني: المحتوى */}
              <div className="space-y-3.5 pt-2 border-t border-white/10">
                <h3 className="text-base sm:text-lg font-black text-cyan-300 flex items-center gap-2">
                  <MonitorPlay className="w-5 h-5 text-cyan-400" />
                  <span>المحتوى</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* المنصة */}
                  <a
                    href="https://www.youtube.com/@MrMohamedElgazzar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-cyan-500/20 hover:to-slate-950 border border-cyan-400/35 hover:border-cyan-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-slate-950 transition-colors">
                        <MonitorPlay className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">المنصة</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        منصتنا التعليمية
                      </p>
                    </div>
                  </a>

                  {/* يوتيوب */}
                  <a
                    href="https://www.youtube.com/@MrMohamedElgazzar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-rose-500/20 hover:to-slate-950 border border-rose-400/35 hover:border-rose-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        <Youtube className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-rose-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">يوتيوب</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        اشترك في قناة اليوتيوب
                      </p>
                    </div>
                  </a>

                  {/* فيسبوك */}
                  <a
                    href="https://www.facebook.com/MrElgazzar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-blue-500/20 hover:to-slate-950 border border-blue-400/35 hover:border-blue-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Facebook className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">فيسبوك</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        تابع صفحتنا
                      </p>
                    </div>
                  </a>

                  {/* إنستجرام */}
                  <a
                    href="https://www.instagram.com/elgazzar_2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-pink-500/20 hover:to-slate-950 border border-pink-400/35 hover:border-pink-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-400/40 text-pink-300 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors">
                        <Instagram className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-pink-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">إنستجرام</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        تابعنا على إنستجرام
                      </p>
                    </div>
                  </a>

                  {/* تيك توك */}
                  <a
                    href="https://www.tiktok.com/@elgazzar_2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-5 rounded-2xl bg-slate-950/70 hover:bg-gradient-to-br hover:from-violet-500/20 hover:to-slate-950 border border-violet-400/35 hover:border-violet-400 flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-400/40 text-violet-300 flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors">
                        <Video className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-violet-300 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">تيك توك</div>
                      <p className="text-xs font-bold text-slate-300 leading-relaxed">
                        دروس قصيرة
                      </p>
                    </div>
                  </a>
                </div>
              </div>

              {/* القسم الثالث: المكان */}
              <div className="space-y-3.5 pt-2 border-t border-white/10">
                <h3 className="text-base sm:text-lg font-black text-cyan-300 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <span>المكان</span>
                </h3>

                <a
                  href="https://www.google.com/maps?q=Mohamed+ElGazzar+Academy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group p-5 rounded-2xl bg-gradient-to-l from-emerald-500/15 via-cyan-500/10 to-slate-950/80 border border-emerald-400/40 hover:border-emerald-300 flex items-center justify-between gap-4 transition-all hover:scale-[1.01] shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-13 h-13 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center group-hover:bg-emerald-400 group-hover:text-slate-950 transition-colors shrink-0">
                      <MapPin className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base sm:text-lg font-black text-white">خريطة جوجل</div>
                      <p className="text-xs sm:text-sm font-bold text-slate-300">
                        اتبع خريطة جوجل للوصول إلينا
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-xs font-black shrink-0 group-hover:bg-emerald-400 group-hover:text-slate-950 transition-colors">
                    <span>فتح الموقع</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </a>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
