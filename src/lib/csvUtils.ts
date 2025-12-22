export interface CSVShiftRow {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: string;
}

export interface ParsedShift {
  userId: string | null;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: 'pending' | 'paid';
  error?: string;
}

export interface ParseResult {
  shifts: ParsedShift[];
  errors: string[];
  totalRows: number;
}

interface UserMapping {
  id: string;
  username: string;
  full_name: string | null;
}

/**
 * Parse CSV content and validate shift data
 */
export function parseShiftsCSV(
  content: string, 
  users: UserMapping[]
): ParseResult {
  const lines = content.split('\n').filter(line => line.trim());
  const errors: string[] = [];
  const shifts: ParsedShift[] = [];
  
  if (lines.length === 0) {
    return { shifts: [], errors: ['Il file CSV è vuoto'], totalRows: 0 };
  }

  // Parse header
  const headerLine = lines[0].toLowerCase();
  const hasValidHeader = 
    headerLine.includes('nome') || 
    headerLine.includes('dipendente') ||
    headerLine.includes('data');

  const startIndex = hasValidHeader ? 1 : 0;
  const totalRows = lines.length - startIndex;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const rowNumber = i + 1;
    const columns = parseCSVLine(line);

    if (columns.length < 4) {
      errors.push(`Riga ${rowNumber}: formato non valido (servono almeno 4 colonne)`);
      continue;
    }

    const [employeeName, date, startTime, endTime, notes = '', statusRaw = 'pending'] = columns;

    // Validate and parse date
    const parsedDate = parseDate(date.trim());
    if (!parsedDate) {
      errors.push(`Riga ${rowNumber}: data non valida "${date}"`);
      continue;
    }

    // Validate time format
    const normalizedStart = normalizeTime(startTime.trim());
    const normalizedEnd = normalizeTime(endTime.trim());
    
    if (!normalizedStart || !normalizedEnd) {
      errors.push(`Riga ${rowNumber}: formato orario non valido`);
      continue;
    }

    // Parse status
    const status = parseStatus(statusRaw.trim());

    // Find user by name
    const userId = findUserByName(employeeName.trim(), users);

    shifts.push({
      userId,
      userName: employeeName.trim(),
      date: parsedDate,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      notes: notes.trim(),
      status,
      error: userId ? undefined : 'Utente non trovato'
    });
  }

  return { shifts, errors, totalRows };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse date in various formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
 */
function parseDate(dateStr: string): string | null {
  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY format
  const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Normalize time to HH:MM format
 */
function normalizeTime(timeStr: string): string | null {
  // Handle HH:MM format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }

  // Handle H.MM or HH.MM format
  const dotMatch = timeStr.match(/^(\d{1,2})\.(\d{2})$/);
  if (dotMatch) {
    const hours = dotMatch[1].padStart(2, '0');
    const minutes = dotMatch[2];
    return `${hours}:${minutes}`;
  }

  return null;
}

/**
 * Parse status string to valid enum value
 */
function parseStatus(statusStr: string): 'pending' | 'paid' {
  const lower = statusStr.toLowerCase();
  if (lower === 'paid' || lower === 'pagato' || lower === '1') {
    return 'paid';
  }
  return 'pending';
}

/**
 * Find user ID by name (matches username or full_name)
 */
function findUserByName(name: string, users: UserMapping[]): string | null {
  const nameLower = name.toLowerCase().trim();
  
  // Exact match on username
  const exactUsername = users.find(u => u.username.toLowerCase() === nameLower);
  if (exactUsername) return exactUsername.id;

  // Exact match on full_name
  const exactFullName = users.find(u => u.full_name?.toLowerCase() === nameLower);
  if (exactFullName) return exactFullName.id;

  // Partial match on full_name
  const partialFullName = users.find(u => 
    u.full_name?.toLowerCase().includes(nameLower) || 
    nameLower.includes(u.full_name?.toLowerCase() || '')
  );
  if (partialFullName) return partialFullName.id;

  // Partial match on username
  const partialUsername = users.find(u => 
    u.username.toLowerCase().includes(nameLower) || 
    nameLower.includes(u.username.toLowerCase())
  );
  if (partialUsername) return partialUsername.id;

  return null;
}

/**
 * Generate sample CSV content for download
 */
export function generateSampleCSV(): string {
  return `Nome dipendente,Data,Entrata,Uscita,Note,Stato
Mario Rossi,25/12/2024,09:00,17:00,Turno festivo,pending
Anna Verdi,26/12/2024,14:00,22:00,,paid
Luca Bianchi,2024-12-27,08:30,16:30,Note esempio,pending`;
}
