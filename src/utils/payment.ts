export type PaymentStatusTone = 'paid' | 'exempt' | 'pending' | 'late' | 'unpaid' | 'overdue';

export interface PaymentStatusPresentation {
  rawText: string;
  displayText: string;
  tone: PaymentStatusTone;
  isPaid: boolean;
  isExemptOrDiscount: boolean;
}

export interface StudentPaymentRecord {
  key: string;
  grade: string;
  studentCode: string;
  studentName: string;
  group: string;
  monthsStatus: Record<number, string>; // month number (1..12) -> exact status string from sheet
  paidAmount: string;
  paymentDate: string;
  lastUpdated: string;
  financialSummary: string;
  source: 'dashboard' | 'database';
}

export interface MonthPaymentSnapshot {
  monthNumber: number;
  monthNameAr: string;
  label: string; // e.g. "الشهر الحالي (نوفمبر)" or "الشهر السابق (أكتوبر)"
  status: PaymentStatusPresentation;
}

export interface StudentPaymentSummary {
  studentCode: string;
  grade: string;
  previousMonth: MonthPaymentSnapshot;
  currentMonth: MonthPaymentSnapshot;
  recordedPaymentDate: string; // populated only when a payment is actually recorded
  paidAmount: string;
  financialSummary: string;
}

export const PAYMENT_MONTH_NAMES_AR: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
};

export function normalizePaymentDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim();
}

export function normalizePaymentArabicText(input: string): string {
  return String(input || '')
    .replace(/^الصف\s+/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMatchingPaymentStudentCode(rowCodeRaw: string, targetCodeRaw: string): boolean {
  const cleanRow = normalizePaymentDigits(rowCodeRaw);
  const cleanTarget = normalizePaymentDigits(targetCodeRaw);
  if (!cleanRow || !cleanTarget) return false;
  if (cleanRow === cleanTarget) return true;
  if (/^\d+$/.test(cleanRow) && /^\d+$/.test(cleanTarget)) {
    return cleanRow.replace(/^0+/, '') === cleanTarget.replace(/^0+/, '');
  }
  return false;
}

/**
 * تحديد رقم واسم الشهر الحالي والشهر السابق تلقائياً حسب التقويم العالمي
 */
export function getCurrentAndPreviousCalendarMonths(referenceDate: Date = new Date()): {
  currentMonth: number;
  currentMonthNameAr: string;
  previousMonth: number;
  previousMonthNameAr: string;
} {
  const currentMonth = referenceDate.getMonth() + 1; // 1..12
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  return {
    currentMonth,
    currentMonthNameAr: PAYMENT_MONTH_NAMES_AR[currentMonth] || `شهر ${currentMonth}`,
    previousMonth,
    previousMonthNameAr: PAYMENT_MONTH_NAMES_AR[previousMonth] || `شهر ${previousMonth}`,
  };
}

export function parsePaymentMonthHeader(headerText: string): number | null {
  const norm = normalizePaymentArabicText(headerText);
  if (!norm) return null;
  if (norm === 'اغسطس' || norm.includes('اغسطس')) return 8;
  if (norm === 'سبتمبر' || norm.includes('سبتمبر')) return 9;
  if (norm === 'اكتوبر' || norm.includes('اكتوبر')) return 10;
  if (norm === 'نوفمبر' || norm.includes('نوفمبر')) return 11;
  if (norm === 'ديسمبر' || norm.includes('ديسمبر')) return 12;
  if (norm === 'يناير' || norm.includes('يناير')) return 1;
  if (norm === 'فبراير' || norm.includes('فبراير')) return 2;
  if (norm === 'مارس' || norm.includes('مارس')) return 3;
  if (norm === 'ابريل' || norm.includes('ابريل')) return 4;
  if (norm === 'مايو' || norm.includes('مايو')) return 5;
  if (norm === 'يونيو' || norm.includes('يونيو')) return 6;
  if (norm === 'يوليو' || norm.includes('يوليو')) return 7;
  return null;
}

/**
 * تصنيف حالة الدفع المسجلة في الشيت (مع الحفاظ على النص المكتوب في الشيت كما هو)
 */
export function classifyPaymentStatus(rawStatus: string): PaymentStatusPresentation {
  const trimmed = String(rawStatus || '').trim();
  const norm = normalizePaymentArabicText(trimmed);

  if (!trimmed || trimmed === '-') {
    return {
      rawText: trimmed,
      displayText: 'غير مسجل بعد',
      tone: 'pending',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (
    norm.includes('لم يات') ||
    norm.includes('لم يحن') ||
    norm.includes('الموعد بعد') ||
    norm.includes('قادم')
  ) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'pending',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (norm.includes('اكثر من شهر')) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'overdue',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (norm.includes('متاخر') || norm.includes('إنذار')) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'late',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (norm.includes('لم يدفع') || norm.includes('غير مسدد') || norm.includes('لم يسدد')) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'unpaid',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (norm.includes('اعفاء') || norm.includes('تخفيض') || norm.includes('خصم') || norm.includes('منحه')) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'exempt',
      isPaid: true,
      isExemptOrDiscount: true,
    };
  }

  if (
    norm.includes('تم الدفع') ||
    norm.includes('مدفوع') ||
    norm.includes('خالص') ||
    norm.includes('سدد') ||
    norm === 'تم'
  ) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      tone: 'paid',
      isPaid: true,
      isExemptOrDiscount: false,
    };
  }

  return {
    rawText: trimmed,
    displayText: trimmed,
    tone: 'pending',
    isPaid: false,
    isExemptOrDiscount: false,
  };
}

/**
 * تطبيق قاعدة السداد المقدم للشهر الحالي تلقائياً حسب اليوم من الشهر:
 * - إذا كان مسجلاً "تم الدفع" أو "إعفاء" أو "تخفيض" تبقى الحالة كما هي.
 * - إذا لم يتم الدفع:
 *   - من يوم 2 إلى 9 في الشهر => "متأخر عن الدفع"
 *   - من يوم 10 حتى نهاية الشهر => "لم يدفع"
 *   - يوم 1 في الشهر => تبقى حالة الشيت كما هي ("لم يأتِ الموعد بعد" أو النص المسجل)
 */
export function resolveCurrentMonthAdvancePaymentStatus(
  rawStatus: string,
  referenceDate: Date = new Date()
): PaymentStatusPresentation {
  const base = classifyPaymentStatus(rawStatus);
  if (base.isPaid || base.isExemptOrDiscount) {
    return base;
  }

  const normRaw = normalizePaymentArabicText(base.rawText);
  if (normRaw.includes('اكثر من شهر')) {
    return base;
  }

  const dayOfMonth = referenceDate.getDate();
  if (dayOfMonth >= 10) {
    return {
      rawText: base.rawText,
      displayText: 'لم يدفع',
      tone: 'unpaid',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  if (dayOfMonth >= 2) {
    return {
      rawText: base.rawText,
      displayText: 'متأخر عن الدفع',
      tone: 'late',
      isPaid: false,
      isExemptOrDiscount: false,
    };
  }

  return base;
}

/**
 * إعادة تقييم ملخص الدفع لحظياً عند تغير اليوم أو الشهر في التقويم العالمي
 */
export function applyCalendarDeadlineToPaymentSummary(
  summary: StudentPaymentSummary,
  referenceDate: Date = new Date()
): StudentPaymentSummary {
  const { currentMonth, currentMonthNameAr, previousMonth, previousMonthNameAr } =
    getCurrentAndPreviousCalendarMonths(referenceDate);

  // إذا كان الشهر الحالي مطابقاً لنفس الشهر المخزن في الملخص نحدّث حالة الاستحقاق التلقائية لليوم
  if (summary.currentMonth.monthNumber === currentMonth) {
    const rawForCurrent = summary.currentMonth.status.rawText || summary.currentMonth.status.displayText;
    const updatedCurrStatus = resolveCurrentMonthAdvancePaymentStatus(rawForCurrent, referenceDate);
    if (
      updatedCurrStatus.displayText === summary.currentMonth.status.displayText &&
      updatedCurrStatus.tone === summary.currentMonth.status.tone
    ) {
      return summary;
    }
    return {
      ...summary,
      currentMonth: {
        ...summary.currentMonth,
        status: updatedCurrStatus,
      },
    };
  }

  // عند انتقال التقويم لشهر جديد: يصبح الشهر الحالي القديم هو الشهر السابق، والشهر الجديد يُقيّم كشهر حالي
  const shiftedPrevStatus =
    summary.currentMonth.monthNumber === previousMonth
      ? summary.currentMonth.status
      : classifyPaymentStatus('');

  return {
    ...summary,
    previousMonth: {
      monthNumber: previousMonth,
      monthNameAr: previousMonthNameAr,
      label: `الشهر السابق · ${previousMonthNameAr}`,
      status: shiftedPrevStatus,
    },
    currentMonth: {
      monthNumber: currentMonth,
      monthNameAr: currentMonthNameAr,
      label: `الشهر الحالي · ${currentMonthNameAr}`,
      status: resolveCurrentMonthAdvancePaymentStatus('', referenceDate),
    },
  };
}

/**
 * تنسيق تاريخ السداد أو تاريخ تسجيل الحالة للعرض بوضوح
 */
export function formatPaymentDateForDisplay(rawDate: string): string {
  const clean = normalizePaymentDigits(rawDate).replace(/\s+/g, ' ').trim();
  if (!clean || clean === '-') return '';

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  return clean;
}

/**
 * تحليل صفوف ورقة "قاعدة بيانات الدفع" (تضم جميع الطلاب عبر كل الصفوف والمجموعات)
 */
export function parsePaymentDatabaseRows(rows: string[][]): StudentPaymentRecord[] {
  if (!rows || rows.length < 2) return [];
  const headers = (rows[0] || []).map((h) => String(h || '').trim());

  let gradeIdx = 1;
  let codeIdx = 2;
  let nameIdx = 3;
  let paidAmountIdx = -1;
  let paymentDateIdx = -1;
  let lastUpdatedIdx = -1;
  const monthCols: Array<{ colIdx: number; monthNum: number }> = [];

  headers.forEach((h, idx) => {
    const norm = normalizePaymentArabicText(h);
    const monthNum = parsePaymentMonthHeader(h);
    if (monthNum !== null) {
      monthCols.push({ colIdx: idx, monthNum });
    } else if (norm === 'الصف' || norm.includes('الصف الدراسي')) {
      gradeIdx = idx;
    } else if (norm.includes('كود')) {
      codeIdx = idx;
    } else if (norm.includes('اسم الطالب') || norm === 'الاسم') {
      nameIdx = idx;
    } else if (norm.includes('المبلغ')) {
      paidAmountIdx = idx;
    } else if (norm.includes('تاريخ السداد') || norm.includes('تاريخ الدفع')) {
      paymentDateIdx = idx;
    } else if (norm.includes('اخر تحديث') || norm.includes('تاريخ التسجيل')) {
      lastUpdatedIdx = idx;
    }
  });

  const records: StudentPaymentRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const studentCode = normalizePaymentDigits(String(row[codeIdx] || ''));
    if (!studentCode) continue;

    const grade = String(row[gradeIdx] || '').trim();
    const studentName = String(row[nameIdx] || '').trim();
    const monthsStatus: Record<number, string> = {};

    for (const mc of monthCols) {
      const val = String(row[mc.colIdx] || '').trim();
      if (val) {
        monthsStatus[mc.monthNum] = val;
      }
    }

    records.push({
      key: String(row[0] || `${grade}_${studentCode}`).trim(),
      grade,
      studentCode,
      studentName,
      group: '',
      monthsStatus,
      paidAmount: paidAmountIdx !== -1 ? String(row[paidAmountIdx] || '').trim() : '',
      paymentDate: paymentDateIdx !== -1 ? String(row[paymentDateIdx] || '').trim() : '',
      lastUpdated: lastUpdatedIdx !== -1 ? String(row[lastUpdatedIdx] || '').trim() : '',
      financialSummary: '',
      source: 'database',
    });
  }

  return records;
}

/**
 * تحليل صفوف ورقة "حالة الدفع" الظاهرة (تضم الصف/المجموعة المعروضة حالياً وتحديثاتها الفورية)
 */
export function parsePaymentDashboardRows(rows: string[][]): StudentPaymentRecord[] {
  if (!rows || rows.length < 3) return [];

  let activeDashboardGrade = '';
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const norm = normalizePaymentArabicText(row[c] || '');
      if (norm.includes('الصف الدراسي') && rows[r + 1]?.[c]) {
        const val = String(rows[r + 1][c] || '').trim();
        if (val && !val.includes('جميع الصفوف') && !val.includes('اختر')) {
          activeDashboardGrade = val;
        }
      }
    }
  }

  let headerRowIdx = -1;
  let codeIdx = 2;
  let nameIdx = 3;
  let groupIdx = 4;
  let paidAmountIdx = -1;
  let paymentDateIdx = -1;
  let summaryIdx = -1;
  const monthCols: Array<{ colIdx: number; monthNum: number }> = [];

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    const joinedNorm = normalizePaymentArabicText(row.join(' '));
    if (joinedNorm.includes('كود الطالب') && joinedNorm.includes('اسم الطالب')) {
      headerRowIdx = r;
      row.forEach((cell, idx) => {
        const norm = normalizePaymentArabicText(cell || '');
        const mNum = parsePaymentMonthHeader(cell || '');
        if (mNum !== null) {
          monthCols.push({ colIdx: idx, monthNum: mNum });
        } else if (norm.includes('كود')) {
          codeIdx = idx;
        } else if (norm.includes('اسم الطالب') || norm === 'الاسم') {
          nameIdx = idx;
        } else if (norm.includes('المجموعه') || norm === 'مجموعه') {
          groupIdx = idx;
        } else if (norm.includes('المبلغ المدفوع') || norm.includes('المبلغ')) {
          paidAmountIdx = idx;
        } else if (norm.includes('تاريخ السداد') || norm.includes('تاريخ الدفع')) {
          paymentDateIdx = idx;
        } else if (norm.includes('الموقف المالي')) {
          summaryIdx = idx;
        }
      });
      break;
    }
  }

  if (headerRowIdx === -1) return [];

  const records: StudentPaymentRecord[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const studentCode = normalizePaymentDigits(String(row[codeIdx] || ''));
    const studentName = String(row[nameIdx] || '').trim();
    if (!studentCode || !studentName || studentName.includes('لا يوجد طلاب') || studentName.includes('يرجى اختيار')) {
      continue;
    }

    const monthsStatus: Record<number, string> = {};
    for (const mc of monthCols) {
      const val = String(row[mc.colIdx] || '').trim();
      if (val) {
        monthsStatus[mc.monthNum] = val;
      }
    }

    records.push({
      key: `${activeDashboardGrade}_${studentCode}`,
      grade: activeDashboardGrade,
      studentCode,
      studentName,
      group: String(row[groupIdx] || '').trim(),
      monthsStatus,
      paidAmount: paidAmountIdx !== -1 ? String(row[paidAmountIdx] || '').trim() : '',
      paymentDate: paymentDateIdx !== -1 ? String(row[paymentDateIdx] || '').trim() : '',
      lastUpdated: '',
      financialSummary: summaryIdx !== -1 ? String(row[summaryIdx] || '').trim() : '',
      source: 'dashboard',
    });
  }

  return records;
}

/**
 * استخراج ملخص حالة الدفع للطالب (الشهر الحالي والشهر السابق + تاريخ السداد إن وجد)
 */
export function buildStudentPaymentSummary(
  records: StudentPaymentRecord[],
  gradeName: string,
  studentCode: string,
  referenceDate: Date = new Date()
): StudentPaymentSummary | null {
  if (!records || records.length === 0) return null;

  const targetGradeNorm = normalizePaymentArabicText(gradeName);

  // 1. نبحث عن سجل مطابق في لوحة "حالة الدفع" أولاً ثم "قاعدة بيانات الدفع"
  const matching = records.filter((rec) => {
    const codeMatch = isMatchingPaymentStudentCode(rec.studentCode, studentCode);
    if (!codeMatch) return false;
    if (!rec.grade || !targetGradeNorm) return true;
    return normalizePaymentArabicText(rec.grade) === targetGradeNorm;
  });

  if (matching.length === 0) return null;

  const dashboardMatch = matching.find((m) => m.source === 'dashboard');
  const dbMatch = matching.find((m) => m.source === 'database');

  const mergedMonths: Record<number, string> = {
    ...(dbMatch?.monthsStatus || {}),
    ...(dashboardMatch?.monthsStatus || {}),
  };

  const primary = dashboardMatch || dbMatch!;
  const { currentMonth, currentMonthNameAr, previousMonth, previousMonthNameAr } =
    getCurrentAndPreviousCalendarMonths(referenceDate);

  const prevStatus = classifyPaymentStatus(mergedMonths[previousMonth] || '');
  const currStatus = resolveCurrentMonthAdvancePaymentStatus(
    mergedMonths[currentMonth] || '',
    referenceDate
  );

  // التحقق من وجود دفع مسجل لعرض تاريخ السداد/التسجيل (فقط لو دفع فعلاً)
  const anyPaidInHistory =
    prevStatus.isPaid ||
    currStatus.isPaid ||
    Object.values(mergedMonths).some((v) => classifyPaymentStatus(v).isPaid);

  const rawDateCandidate =
    primary.paymentDate ||
    dbMatch?.paymentDate ||
    primary.lastUpdated ||
    dbMatch?.lastUpdated ||
    '';

  const recordedPaymentDate = anyPaidInHistory
    ? formatPaymentDateForDisplay(rawDateCandidate)
    : '';

  return {
    studentCode: primary.studentCode,
    grade: primary.grade || gradeName,
    previousMonth: {
      monthNumber: previousMonth,
      monthNameAr: previousMonthNameAr,
      label: `الشهر السابق · ${previousMonthNameAr}`,
      status: prevStatus,
    },
    currentMonth: {
      monthNumber: currentMonth,
      monthNameAr: currentMonthNameAr,
      label: `الشهر الحالي · ${currentMonthNameAr}`,
      status: currStatus,
    },
    recordedPaymentDate,
    paidAmount: primary.paidAmount || dbMatch?.paidAmount || '',
    financialSummary: primary.financialSummary || '',
  };
}
