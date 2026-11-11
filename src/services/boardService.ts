import { getAccessToken } from './googleAuth';
import { discoverSpreadsheetTabs, parseCsvToRows } from './sheetsService';

// رابط ومعرف شيت "سبورة الحصص والملخصات" الرسمي المربوط بالموقع لحظياً
export const DEFAULT_BOARD_SPREADSHEET_ID =
  '1z8_TKEB9UjxieAdv0htzC6x0YioxeK4SSDM7PkjgSCo';
export const DEFAULT_BOARD_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1z8_TKEB9UjxieAdv0htzC6x0YioxeK4SSDM7PkjgSCo/edit?usp=sharing';

// متغير اختياري في حال رغب المعلم في استخدام Google Apps Script Web App
export const BOARD_SCRIPT_URL = '';

export interface FormattedBoardImage {
  originalUrl: string;
  viewUrl: string;
  fallbackViewUrl: string;
  downloadUrl: string;
  fileId: string | null;
}

export interface BoardExtraField {
  title: string;
  value: string;
}

export interface BoardLessonItem {
  id: string;
  rowNumber: number;
  grade: string;
  rawGrade: string;
  dateLabel: string;
  sessionAndBranch: string;
  lessonTitle: string;
  rawImageUrls: string[];
  images: FormattedBoardImage[];
  homeworkAndNotes: string;
  extraFields: BoardExtraField[];
  branchCategory: 'جبر' | 'هندسة' | 'حساب مثلثات' | 'حساب' | 'عام';
  isLatest?: boolean;
}

// الأوراق المعروفة في شيت سبورة الحصص (الورقة الرئيسية + أوراق الصفوف الفرعية)
const KNOWN_BOARD_TAB_GIDS: Array<{ name: string; gid: string }> = [
  { name: 'سبورة الحصص', gid: '0' },
  { name: 'الرابع الابتدائي', gid: '104' },
  { name: 'الخامس الابتدائي', gid: '105' },
  { name: 'السادس الابتدائي', gid: '106' },
  { name: 'الأول الإعدادي', gid: '201' },
  { name: 'الثاني الإعدادي', gid: '202' },
  { name: 'الثالث الإعدادي', gid: '203' },
  { name: 'الأول الثانوي', gid: '301' },
  { name: 'الثاني الثانوي', gid: '302' },
  { name: 'الثالث الثانوي', gid: '303' },
];

let cachedBoardTabs: Array<{ name: string; gid: string }> = [...KNOWN_BOARD_TAB_GIDS];
let lastBoardTabsDiscoveryTime = 0;
let isDiscoveringBoardTabs = false;

async function getBoardTabsToRead(): Promise<Array<{ name: string; gid: string }>> {
  const now = Date.now();
  if (!isDiscoveringBoardTabs && now - lastBoardTabsDiscoveryTime > 120000) {
    isDiscoveringBoardTabs = true;
    lastBoardTabsDiscoveryTime = now;
    discoverSpreadsheetTabs(DEFAULT_BOARD_SPREADSHEET_ID)
      .then((discovered) => {
        if (discovered.length > 0) {
          const map = new Map<string, { name: string; gid: string }>();
          for (const t of KNOWN_BOARD_TAB_GIDS) {
            map.set(t.gid, t);
          }
          for (const d of discovered) {
            map.set(d.gid, d);
          }
          cachedBoardTabs = Array.from(map.values());
        }
      })
      .catch(() => {})
      .finally(() => {
        isDiscoveringBoardTabs = false;
      });
  }
  return cachedBoardTabs;
}

/**
 * دالة ذكية لتحويل روابط Google Drive تلقائياً إلى رابط عرض مباشر عالي الدقة (w1600) ورابط تحميل مباشر
 */
export function formatBoardImageUrl(url: string): FormattedBoardImage {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || cleanUrl === '[link removed]') {
    return {
      originalUrl: '',
      viewUrl: '',
      fallbackViewUrl: '',
      downloadUrl: '',
      fileId: null,
    };
  }

  let fileId: string | null = null;

  const fileDMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  const idParamMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  const lh3Match = cleanUrl.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);

  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else if (idParamMatch && idParamMatch[1]) {
    fileId = idParamMatch[1];
  } else if (lh3Match && lh3Match[1]) {
    fileId = lh3Match[1];
  }

  if (fileId) {
    return {
      originalUrl: cleanUrl,
      viewUrl: `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
      fallbackViewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      fileId,
    };
  }

  return {
    originalUrl: cleanUrl,
    viewUrl: cleanUrl,
    fallbackViewUrl: cleanUrl,
    downloadUrl: cleanUrl,
    fileId: null,
  };
}

/**
 * توحيد اسم الصف الدراسي المكتوب في الشيت ليتطابق مع أسماء الصفوف في المنصة
 */
export function normalizeBoardGradeName(rawGrade: string): string {
  const clean = String(rawGrade || '')
    .replace(/^الصف\s+/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

  if (clean.includes('رابع') || clean.includes('4')) return 'الرابع الابتدائي';
  if (clean.includes('خامس') || clean.includes('5')) return 'الخامس الابتدائي';
  if (clean.includes('سادس') || clean.includes('6')) return 'السادس الابتدائي';

  if (clean.includes('اعدادي')) {
    if (clean.includes('اول') || clean.includes('1')) return 'الأول الإعدادي';
    if (clean.includes('ثان') || clean.includes('تان') || clean.includes('2')) {
      return 'الثاني الإعدادي';
    }
    if (clean.includes('ثال') || clean.includes('تال') || clean.includes('3')) {
      return 'الثالث الإعدادي';
    }
  }

  if (clean.includes('ثانوي')) {
    if (clean.includes('اول') || clean.includes('1')) return 'الأول الثانوي';
    if (clean.includes('ثان') || clean.includes('تان') || clean.includes('2')) {
      return 'الثاني الثانوي';
    }
    if (clean.includes('ثال') || clean.includes('تال') || clean.includes('3')) {
      return 'الثالث الثانوي';
    }
  }

  return String(rawGrade || '').replace(/^الصف\s+/, '').trim();
}

/**
 * استنتاج فرع الرياضيات للفلترة السريعة
 */
export function detectBranchCategory(
  sessionAndBranch: string,
  lessonTitle: string
): 'جبر' | 'هندسة' | 'حساب مثلثات' | 'حساب' | 'عام' {
  const combined = `${sessionAndBranch} ${lessonTitle}`
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');

  if (combined.includes('مثلثات')) return 'حساب مثلثات';
  if (combined.includes('هندس')) return 'هندسة';
  if (
    combined.includes('جبر') ||
    combined.includes('معادل') ||
    combined.includes('مقادير') ||
    combined.includes('حدود')
  ) {
    return 'جبر';
  }
  if (combined.includes('حساب')) return 'حساب';
  return 'عام';
}

/**
 * تقسيم خلية روابط الصور: يدعم رابطاً واحداً أو عدة روابط مفصولة بفاصلة أو سطر جديد
 */
function splitImageUrlsCell(rawLinksCell: string): string[] {
  const trimmed = String(rawLinksCell || '').trim();
  if (!trimmed || trimmed === '[link removed]') return [];

  const parts = trimmed
    .split(/\s*(?:,|\n|\r)+\s*(?=https?:\/\/)/i)
    .map((u) => u.trim())
    .filter((u) => u && u !== '[link removed]');

  if (parts.length > 0) return parts;
  return [trimmed];
}

/**
 * تحليل رد Google Visualization JSONP/JSON
 */
function parseGvizBoardResponse(text: string): string[][] {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Invalid gviz response');
  }
  const jsonStr = text.substring(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonStr);
  if (parsed.status === 'error') {
    throw new Error('Gviz error status');
  }

  const table = parsed.table;
  if (!table || !Array.isArray(table.rows)) return [];

  const cols: string[] = (table.cols || []).map((col: { label?: string }) =>
    String(col?.label || '').trim()
  );

  const resultRows: string[][] = [];
  const hasColumnLabels = cols.some((label) => label !== '');
  if (hasColumnLabels) {
    resultRows.push(cols);
  }

  table.rows.forEach((r: { c?: Array<{ v?: unknown; f?: string } | null> }) => {
    const cells = (r.c || []).map((cell) => {
      if (!cell) return '';
      if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
      if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
      return '';
    });
    resultRows.push(cells);
  });

  return resultRows;
}

/**
 * تحويل صفوف جدول الشيت الفعلي إلى كائنات سبورة حقيقية مع قراءة أي خانات أو أعمدة إضافية جديدة (من العمود السابع فصاعداً)
 * بدون أي بيانات افتراضية أو وهمية
 */
export function parseAllBoardRowsFromSheet(
  rows: string[][],
  fallbackGradeFromTab = ''
): BoardLessonItem[] {
  if (!rows || rows.length === 0) return [];

  const headers = (rows[0] || []).map((c) => String(c || '').trim());
  const firstRowJoined = headers.join(' ');
  const hasHeader =
    firstRowJoined.includes('الصف الدراسي') ||
    firstRowJoined.includes('رقم الحصة') ||
    firstRowJoined.includes('اسم الدرس') ||
    firstRowJoined.includes('رابط صورة');

  const startIndex = hasHeader ? 1 : 0;
  const parsedItems: BoardLessonItem[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawGrade = String(row[0] || fallbackGradeFromTab || '').trim();
    const dateLabel = String(row[1] || '').trim();
    const sessionAndBranch = String(row[2] || '').trim();
    const lessonTitle = String(row[3] || '').trim();
    const rawLinksCell = String(row[4] || '').trim();
    const homeworkAndNotes = String(row[5] || '').trim();

    // قراءة أي أعمدة أو خانات جديدة يضيفها المعلم في الشيت (من العمود G / رقم 6 فصاعداً)
    const extraFields: BoardExtraField[] = [];
    const maxCols = Math.max(headers.length, row.length);
    for (let c = 6; c < maxCols; c++) {
      const cellVal = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';
      const colHeader = hasHeader && headers[c] ? headers[c] : `خانة إضافية (${c - 5})`;
      if (cellVal !== '') {
        extraFields.push({
          title: colHeader,
          value: cellVal,
        });
      }
    }

    // تخطي الصفوف الفارغة تماماً أو صف العناوين إن تكرر
    if (!rawGrade && !lessonTitle && !rawLinksCell && !sessionAndBranch && extraFields.length === 0) {
      continue;
    }
    if (rawGrade === 'الصف الدراسي' && lessonTitle === 'اسم الدرس') continue;

    const normalizedGrade = normalizeBoardGradeName(rawGrade || fallbackGradeFromTab);
    const rawUrls = splitImageUrlsCell(rawLinksCell);
    const formattedImages = rawUrls
      .map((u) => formatBoardImageUrl(u))
      .filter((img) => Boolean(img.viewUrl));

    parsedItems.push({
      id: `sheet-row-${i}`,
      rowNumber: i + 1,
      grade: normalizedGrade,
      rawGrade: rawGrade || normalizedGrade,
      dateLabel,
      sessionAndBranch,
      lessonTitle,
      rawImageUrls: rawUrls,
      images: formattedImages,
      homeworkAndNotes,
      extraFields,
      branchCategory: detectBranchCategory(sessionAndBranch, lessonTitle),
    });
  }

  return parsedItems;
}

/**
 * دمج الحصص المقروءة من الورقة الرئيسية وأوراق الصفوف الفرعية مع منع التكرار وتفضيل السطر الأحدث أو الذي يحتوي على روابط صور كاملة
 */
function mergeAndRankBoardItems(items: BoardLessonItem[]): BoardLessonItem[] {
  const byKey = new Map<string, BoardLessonItem>();

  for (const item of items) {
    const key = `${item.grade}||${item.sessionAndBranch}||${item.lessonTitle}`.trim();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
    } else {
      // تفضيل النسخة التي تحتوي على صور صالحة أو خانات إضافية أحدث
      const useNew =
        (item.images.length > existing.images.length) ||
        (item.extraFields.length > existing.extraFields.length) ||
        (item.homeworkAndNotes && !existing.homeworkAndNotes);
      if (useNew) {
        byKey.set(key, {
          ...existing,
          ...item,
          images: item.images.length > 0 ? item.images : existing.images,
          rawImageUrls:
            item.rawImageUrls.length > 0 ? item.rawImageUrls : existing.rawImageUrls,
          extraFields:
            item.extraFields.length > 0 ? item.extraFields : existing.extraFields,
        });
      }
    }
  }

  // ترتيب من الأحدث إلى الأقدم (آخر سطر يكتبه المعلم في الشيت يظهر أولاً)
  const merged = Array.from(byKey.values()).reverse();

  // تمييز أحدث حصة لكل صف دراسي بشارة "جديد ✨"
  const seenGrades = new Set<string>();
  merged.forEach((item, idx) => {
    item.id = `board-item-${idx + 1}`;
    if (!seenGrades.has(item.grade)) {
      item.isLatest = true;
      seenGrades.add(item.grade);
    } else {
      item.isLatest = false;
    }
  });

  return merged;
}

/**
 * الجلب الفوري الحي لكافة الحصص والخانات الجديدة المسجلة في شيت سبورة الحصص (`1z8_TKEB9UjxieAdv0htzC6x0YioxeK4SSDM7PkjgSCo`)
 * يقرأ الورقة الرئيسية وكافة أوراق الصفوف داخل الشيت بدون أي بيانات وهمية
 */
export async function fetchAllLiveBoardsFromSheet(): Promise<BoardLessonItem[]> {
  const spreadsheetId = DEFAULT_BOARD_SPREADSHEET_ID;
  const timestamp = Date.now();

  // 1. إذا قام المعلم بوضع رابط Apps Script مخصص في BOARD_SCRIPT_URL
  if (BOARD_SCRIPT_URL.trim() !== '') {
    try {
      const scriptUrl = `${BOARD_SCRIPT_URL}${
        BOARD_SCRIPT_URL.includes('?') ? '&' : '?'
      }t=${timestamp}`;
      const res = await fetch(scriptUrl, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const rows: string[][] = Array.isArray(json)
          ? json
          : Array.isArray(json.rows)
          ? json.rows
          : [];
        const parsed = parseAllBoardRowsFromSheet(rows);
        if (parsed.length > 0) return mergeAndRankBoardItems(parsed);
      }
    } catch {
      // المتابعة إلى CSV Export
    }
  }

  // 2. القراءة المباشرة عبر CSV Export لجميع أوراق شيت السبورة (الرئيسية + أوراق الصفوف)
  try {
    const tabs = await getBoardTabsToRead();
    const tabResults = await Promise.all(
      tabs.map(async (tab) => {
        try {
          const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${tab.gid}&_t=${timestamp}`;
          const res = await fetch(csvUrl, { cache: 'no-store' });
          if (!res.ok) return [];
          const csvText = await res.text();
          if (csvText.trim().startsWith('<!DOCTYPE html>')) return [];
          const rows = parseCsvToRows(csvText);
          const fallbackGrade = tab.gid === '0' ? '' : tab.name;
          return parseAllBoardRowsFromSheet(rows, fallbackGrade);
        } catch {
          return [];
        }
      })
    );

    const combined = tabResults.flat();
    if (combined.length > 0) {
      return mergeAndRankBoardItems(combined);
    }
  } catch {
    // المتابعة إلى Google Visualization API
  }

  // 3. القراءة عبر Google Visualization JSON API كبديل
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=0&headers=0&_t=${timestamp}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (!text.trim().startsWith('<!DOCTYPE html>')) {
        const rows = parseGvizBoardResponse(text);
        return mergeAndRankBoardItems(parseAllBoardRowsFromSheet(rows));
      }
    }
  } catch {
    // المتابعة إلى Sheets API v4
  }

  // 4. القراءة عبر Google Sheets API v4 في حال وجود توكن مفعل
  const token = await getAccessToken();
  if (token) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:ZZ500?_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const values: string[][] = Array.isArray(data.values) ? data.values : [];
        return mergeAndRankBoardItems(parseAllBoardRowsFromSheet(values));
      }
    } catch {
      // ignore
    }
  }

  return [];
}
