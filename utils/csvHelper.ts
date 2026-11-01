import { Category, Question } from '../types';

/**
 * Normalizes input string to match one of the Category enum values.
 */
export const normalizeCategory = (input: string): Category => {
  const clean = (input || '').trim().toLowerCase();
  
  if (clean.includes('deutsch') || clean.includes('sprache') || clean.includes('literatur')) {
    return Category.DEUTSCH;
  }
  if (clean.includes('mathe') || clean.includes('physik') || clean.includes('rechnen') || clean.includes('natur')) {
    return Category.MATHEMATIK;
  }
  if (clean.includes('sach') || clean.includes('geo') || clean.includes('bio') || clean.includes('geschichte') || clean.includes('hsu')) {
    return Category.SACHUNTERRICHT;
  }
  if (clean.includes('englisch') || clean.includes('english')) {
    return Category.ENGLISCH;
  }
  if (clean.includes('kunst') || clean.includes('musik') || clean.includes('kultur') || clean.includes('malen')) {
    return Category.KUNST_MUSIK;
  }
  if (clean.includes('sport') || clean.includes('gesundheit') || clean.includes('bewegung')) {
    return Category.SPORT;
  }
  if (clean.includes('werk') || clean.includes('technik') || clean.includes('gestalten')) {
    return Category.WERKEN;
  }
  if (clean.includes('ethik') || clean.includes('religion') || clean.includes('philosophie') || clean.includes('werte')) {
    return Category.ETHIK;
  }

  // Exact match attempt
  const categories = Object.values(Category);
  const found = categories.find(c => c.toLowerCase() === clean);
  if (found) return found;

  // Fallback to General Knowledge / Sachkunde
  return Category.SACHUNTERRICHT;
};

/**
 * Escapes a CSV cell according to RFC 4180
 */
const escapeCsvCell = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(';') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Exports a list of questions as CSV file with UTF-8 BOM.
 * Uses semicolon as standard separator for German/European spreadsheet software (Excel, LibreOffice).
 */
export const exportQuestionsToCsv = (questions: Question[], filename?: string): void => {
  const headers = [
    'id',
    'kategorie',
    'klasse',
    'frage',
    'antwort',
    'option1',
    'option2',
    'option3',
    'option4'
  ];

  const rows = questions.map(q => {
    const opts = q.options || [];
    return [
      escapeCsvCell(q.id),
      escapeCsvCell(q.category),
      escapeCsvCell(q.minGrade),
      escapeCsvCell(q.question),
      escapeCsvCell(q.answer),
      escapeCsvCell(opts[0] || ''),
      escapeCsvCell(opts[1] || ''),
      escapeCsvCell(opts[2] || ''),
      escapeCsvCell(opts[3] || '')
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const actualFilename = filename || `schul_trivia_quiz_fragen_${new Date().toISOString().slice(0, 10)}.csv`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Robust CSV parser that handles quotes, delimiters, multi-lines, and variable column orders.
 */
export const parseQuestionsCsv = (
  csvContent: string
): { questions: Question[]; errors: string[]; totalRowsParsed: number } => {
  // Remove BOM if present
  let cleanText = csvContent;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  // Detect delimiter: analyze first 3 non-empty lines
  const linesSample = cleanText.split(/\r?\n/).slice(0, 3).join('\n');
  const semicolonCount = (linesSample.match(/;/g) || []).length;
  const commaCount = (linesSample.match(/,/g) || []).length;
  const tabCount = (linesSample.match(/\t/g) || []).length;
  
  let delimiter = ';';
  if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semicolonCount) delimiter = ',';

  // Parse lines with RFC 4180 quote awareness
  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n in \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        rawRows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { questions: [], errors: ['Die CSV-Datei ist leer.'], totalRowsParsed: 0 };
  }

  const headerRow = rawRows[0].map(h => h.toLowerCase().replace(/["\s_]/g, ''));
  const headerMap: Record<string, number> = {};

  headerRow.forEach((col, idx) => {
    if (col === 'id' || col === 'nr' || col === 'kennung') headerMap['id'] = idx;
    else if (col.includes('kat') || col.includes('fach') || col.includes('category')) headerMap['category'] = idx;
    else if (col.includes('klasse') || col.includes('stufe') || col.includes('grade')) headerMap['grade'] = idx;
    else if (col.includes('frage') || col.includes('question')) headerMap['question'] = idx;
    else if (col.includes('antwort') || col.includes('loesung') || col.includes('answer') || col.includes('richtig')) headerMap['answer'] = idx;
    else if (col.includes('opt1') || col.includes('option1') || col.includes('auswahl1') || col === 'a') headerMap['opt1'] = idx;
    else if (col.includes('opt2') || col.includes('option2') || col.includes('auswahl2') || col === 'b') headerMap['opt2'] = idx;
    else if (col.includes('opt3') || col.includes('option3') || col.includes('auswahl3') || col === 'c') headerMap['opt3'] = idx;
    else if (col.includes('opt4') || col.includes('option4') || col.includes('auswahl4') || col === 'd') headerMap['opt4'] = idx;
    else if (col.includes('optionen') || col.includes('options')) headerMap['options_combined'] = idx;
  });

  const parsedQuestions: Question[] = [];
  const errors: string[] = [];

  const dataRows = rawRows.slice(1);
  const totalRows = dataRows.length;

  dataRows.forEach((row, rowIdx) => {
    const lineNum = rowIdx + 2;
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    // Extract fields
    const rawId = headerMap['id'] !== undefined ? row[headerMap['id']] : `imp_${Date.now()}_${rowIdx}`;
    const rawCategory = headerMap['category'] !== undefined ? row[headerMap['category']] : (row[1] || 'Sachunterricht');
    const rawGrade = headerMap['grade'] !== undefined ? row[headerMap['grade']] : (row[2] || '4');
    const rawQuestion = headerMap['question'] !== undefined ? row[headerMap['question']] : (row[3] || row[0]);
    const rawAnswer = headerMap['answer'] !== undefined ? row[headerMap['answer']] : (row[4] || row[1]);

    if (!rawQuestion || rawQuestion.trim().length === 0) {
      errors.push(`Zeile ${lineNum}: Keine Frage vorhanden.`);
      return;
    }

    if (!rawAnswer || rawAnswer.trim().length === 0) {
      errors.push(`Zeile ${lineNum}: Keine Antwort für Frage "${rawQuestion.slice(0, 30)}..." definiert.`);
      return;
    }

    let minGrade = parseInt(rawGrade, 10);
    if (isNaN(minGrade) || minGrade < 2) minGrade = 2;
    if (minGrade > 12) minGrade = 12;

    const category = normalizeCategory(rawCategory);

    // Collect options
    const options: string[] = [];
    if (headerMap['options_combined'] !== undefined && row[headerMap['options_combined']]) {
      const splitOpts = row[headerMap['options_combined']].split(/[,|;]/).map(s => s.trim()).filter(Boolean);
      options.push(...splitOpts);
    } else {
      ['opt1', 'opt2', 'opt3', 'opt4'].forEach(optKey => {
        if (headerMap[optKey] !== undefined && row[headerMap[optKey]]) {
          options.push(row[headerMap[optKey]].trim());
        }
      });
      // Fallback if positional headers weren't found
      if (options.length === 0 && row.length >= 6) {
        for (let i = 5; i < Math.min(row.length, 9); i++) {
          if (row[i]) options.push(row[i].trim());
        }
      }
    }

    // Ensure answer is in options
    const trimmedAnswer = rawAnswer.trim();
    if (!options.includes(trimmedAnswer)) {
      options.unshift(trimmedAnswer);
    }

    // Ensure at least 4 options
    while (options.length < 4) {
      const fallbackOptions = ['Ja', 'Nein', 'Nicht bekannt', 'Vielleicht', 'A', 'B', 'C', 'D'];
      const nextOpt = fallbackOptions.find(o => !options.includes(o)) || `Option ${options.length + 1}`;
      options.push(nextOpt);
    }

    // Shuffle options so answer isn't always in position 0
    const shuffledOptions = [...options.slice(0, 4)].sort(() => Math.random() - 0.5);

    parsedQuestions.push({
      id: rawId ? rawId.trim() : `custom_${Date.now()}_${rowIdx}`,
      category,
      minGrade,
      question: rawQuestion.trim(),
      answer: trimmedAnswer,
      options: shuffledOptions
    });
  });

  return {
    questions: parsedQuestions,
    errors,
    totalRowsParsed: totalRows
  };
};
