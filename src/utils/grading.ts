export interface RawScoreItem {
  title: string;
  value: string | number;
  max?: number;
}

export interface ParsedScoreCard {
  title: string;
  cleanTitle: string;
  rawValue: string;
  earned: number | null;
  max: number | null;
  percentage: number;
  isAttendanceOrPercentageOnly: boolean;
  level: 'excellent' | 'good' | 'weak';
  levelLabel: string;
  categoryIcon: 'algebra' | 'geometry' | 'exam' | 'homework' | 'attendance' | 'general';
}

export interface BadgeInfo {
  emoji: string;
  title: string;
  gradeLabel: string;
  tier: 'legendary' | 'distinguished' | 'rising' | 'review';
  triggerConfetti: boolean;
}

export interface StudentPerformanceSummary {
  totalEarned: number;
  totalMax: number;
  overallPercentage: number;
  parsedCards: ParsedScoreCard[];
  badge: BadgeInfo;
}

export type StageId = 'primary' | 'prep' | 'secondary';

export interface StageDefinition {
  id: StageId;
  label: string;
  shortDesc: string;
  grades: string[];
}

export const STAGES: StageDefinition[] = [
  {
    id: 'primary',
    label: 'المرحلة الابتدائية',
    shortDesc: 'تأسيس الحساب والكسور والهندسة المبكرة',
    grades: ['الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي'],
  },
  {
    id: 'prep',
    label: 'المرحلة الإعدادية',
    shortDesc: 'إتقان الجبر والبرهان الهندسي وحل المعادلات',
    grades: ['الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي'],
  },
  {
    id: 'secondary',
    label: 'المرحلة الثانوية',
    shortDesc: 'التفاضل وحساب المثلثات والرياضيات المتقدمة',
    grades: ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'],
  },
];

export const TEACHER_PHONE_LOCAL = '01009617278';
export const TEACHER_PHONE_INTL = '201009617278';

/**
 * Infers the educational stage for any grade title.
 */
export function getStageForGrade(gradeName: string): StageId {
  if (gradeName.includes('الابتدائي')) return 'primary';
  if (gradeName.includes('الإعدادي') || gradeName.includes('الاعدادي')) return 'prep';
  if (gradeName.includes('الثانوي')) return 'secondary';
  return 'prep';
}

/**
 * Determines semantic category icon type from assessment column name.
 */
export function detectCategoryIcon(title: string): ParsedScoreCard['categoryIcon'] {
  const t = title.trim();
  if (t.includes('حضور') || t.includes('غياب')) return 'attendance';
  if (t.includes('واجب') || t.includes('مواظبة') || t.includes('نشاط')) return 'homework';
  if (t.includes('شهر') || t.includes('شامل') || t.includes('نهائي')) return 'exam';
  if (t.includes('هندسة') || t.includes('قياس') || t.includes('مثلثات')) return 'geometry';
  if (t.includes('جبر') || t.includes('حساب') || t.includes('كسور') || t.includes('تفاضل')) return 'algebra';
  return 'general';
}

/**
 * Parses a single dynamic score cell & column header from Google Sheets or Mock Data.
 * Supports:
 * - Value formatted as "48/50" or "9.5 / 10"
 * - Column header containing max score in parentheses e.g. "امتحان الشهر (50)" with value "48"
 * - Percentage values like "95%" or "95 %" (e.g. نسبة الحضور)
 */
export function parseScoreItem(item: RawScoreItem): ParsedScoreCard {
  const rawStr = String(item.value ?? '').trim();
  const titleStr = String(item.title ?? '').trim();

  // Extract max score from title parentheses like "امتحان الشهر (50)"
  const titleMaxMatch = titleStr.match(/\((\d+(?:\.\d+)?)\)/);
  const maxFromTitle = titleMaxMatch ? parseFloat(titleMaxMatch[1]) : null;
  const cleanTitle = titleStr.replace(/\s*\(\d+(?:\.\d+)?\)\s*/, '').trim();

  const categoryIcon = detectCategoryIcon(titleStr);

  // Case 1: Percentage string like "95%" or attendance column
  if (rawStr.includes('%') || (categoryIcon === 'attendance' && !rawStr.includes('/'))) {
    const numMatch = rawStr.match(/(\d+(?:\.\d+)?)/);
    const pct = numMatch ? Math.min(100, Math.max(0, Math.round(parseFloat(numMatch[1])))) : 0;
    const { level, levelLabel } = getScoreLevel(pct);
    return {
      title: titleStr,
      cleanTitle,
      rawValue: rawStr.includes('%') ? rawStr : `${pct}%`,
      earned: null,
      max: null,
      percentage: pct,
      isAttendanceOrPercentageOnly: true,
      level,
      levelLabel,
      categoryIcon,
    };
  }

  // Case 2: Value contains fraction "earned/max" like "48/50"
  const fractionMatch = rawStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const earned = parseFloat(fractionMatch[1]);
    const max = parseFloat(fractionMatch[2]);
    const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((earned / max) * 100))) : 0;
    const { level, levelLabel } = getScoreLevel(pct);
    return {
      title: titleStr,
      cleanTitle,
      rawValue: `${earned} / ${max}`,
      earned,
      max,
      percentage: pct,
      isAttendanceOrPercentageOnly: false,
      level,
      levelLabel,
      categoryIcon,
    };
  }

  // Case 3: Numeric value with explicit item.max or maxFromTitle
  const numericMatch = rawStr.match(/(\d+(?:\.\d+)?)/);
  const earnedVal = numericMatch ? parseFloat(numericMatch[1]) : 0;
  const maxVal = item.max ?? maxFromTitle ?? (earnedVal <= 10 ? 10 : earnedVal <= 50 ? 50 : 100);
  const pct = maxVal > 0 ? Math.min(100, Math.max(0, Math.round((earnedVal / maxVal) * 100))) : 0;
  const { level, levelLabel } = getScoreLevel(pct);

  return {
    title: titleStr,
    cleanTitle,
    rawValue: `${earnedVal} / ${maxVal}`,
    earned: earnedVal,
    max: maxVal,
    percentage: pct,
    isAttendanceOrPercentageOnly: false,
    level,
    levelLabel,
    categoryIcon,
  };
}

export function getScoreLevel(percentage: number): {
  level: 'excellent' | 'good' | 'weak';
  levelLabel: string;
} {
  if (percentage >= 85) {
    return { level: 'excellent', levelLabel: 'ممتاز' };
  }
  if (percentage >= 65) {
    return { level: 'good', levelLabel: 'جيد' };
  }
  return { level: 'weak', levelLabel: 'يحتاج دعم' };
}

/**
 * Returns the motivational badge and title based on overall percentage:
 * - >= 90%: 🏆 "عبقري الرياضيات - مستوى أسطوري" (with Confetti)
 * - 80% to 89%: ⭐ "نجم الهندسة والجبر - مستوى متميز"
 * - 65% to 79%: 📈 "مشروع بطل - تقدم جيد ويحتاج لمزيد من التركيز"
 * - < 65%: 💡 "تحتاج لمراجعة سريعة مع المستر لتعويض ما فاتك"
 */
export function getBadgeForPercentage(percentage: number): BadgeInfo {
  const rounded = Math.round(percentage);
  if (rounded >= 90) {
    return {
      emoji: '🏆',
      title: 'عبقري الرياضيات - مستوى أسطوري',
      gradeLabel: 'امتياز مع مرتبة الشرف',
      tier: 'legendary',
      triggerConfetti: true,
    };
  }
  if (rounded >= 80) {
    return {
      emoji: '⭐',
      title: 'نجم الهندسة والجبر - مستوى متميز',
      gradeLabel: 'جيد جداً مرتفع',
      tier: 'distinguished',
      triggerConfetti: false,
    };
  }
  if (rounded >= 65) {
    return {
      emoji: '📈',
      title: 'مشروع بطل - تقدم جيد ويحتاج لمزيد من التركيز',
      gradeLabel: 'جيد',
      tier: 'rising',
      triggerConfetti: false,
    };
  }
  return {
    emoji: '💡',
    title: 'تحتاج لمراجعة سريعة مع المستر لتعويض ما فاتك',
    gradeLabel: 'يحتاج متابعة مكثفة',
    tier: 'review',
    triggerConfetti: false,
  };
}

/**
 * Calculates full student performance summary from dynamic score items.
 */
export function evaluateStudentScores(scores: RawScoreItem[]): StudentPerformanceSummary {
  const parsedCards = scores.map(parseScoreItem);

  let totalEarned = 0;
  let totalMax = 0;

  for (const card of parsedCards) {
    if (!card.isAttendanceOrPercentageOnly && card.earned !== null && card.max !== null) {
      totalEarned += card.earned;
      totalMax += card.max;
    }
  }

  let overallPercentage = 0;
  if (totalMax > 0) {
    overallPercentage = Math.round((totalEarned / totalMax) * 100);
  } else if (parsedCards.length > 0) {
    const sumPct = parsedCards.reduce((acc, c) => acc + c.percentage, 0);
    overallPercentage = Math.round(sumPct / parsedCards.length);
  }

  overallPercentage = Math.min(100, Math.max(0, overallPercentage));

  return {
    totalEarned: Math.round(totalEarned * 10) / 10,
    totalMax: Math.round(totalMax * 10) / 10,
    overallPercentage,
    parsedCards,
    badge: getBadgeForPercentage(overallPercentage),
  };
}

/**
 * Builds the WhatsApp URL for discussing a student's result with Mr. Mohamed El-Gazzar.
 */
export function buildStudentWhatsAppUrl(params: {
  name: string;
  grade: string;
  id: string;
  percentage: number;
}): string {
  const message = `السلام عليكم يا مستر محمد، أنا الطالب ${params.name} بالصف ${params.grade} كود ${params.id}، حاصل على نسبة ${params.percentage}%، وكنت أود الاستفسار بخصوص...`;
  return `https://wa.me/${TEACHER_PHONE_INTL}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds the general inquiry WhatsApp URL for floating action button.
 */
export function buildGeneralWhatsAppUrl(): string {
  const message = 'السلام عليكم يا مستر محمد الجزار، كنت أود الاستفسار عن مواعيد ومجموعات مادة الرياضيات...';
  return `https://wa.me/${TEACHER_PHONE_INTL}?text=${encodeURIComponent(message)}`;
}
