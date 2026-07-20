import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const EMPLOYEES_PATH = path.join(DATA_DIR, 'employees.json');
const LEGACY_DRIVERS_PATH = path.join(DATA_DIR, 'drivers.json');

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function resolveHeaderIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function normalizeRoster(data) {
  const employees = data.employees ?? data.drivers ?? [];
  return {
    companyId: data.companyId ?? 'company-1',
    companyName: data.companyName ?? 'Company',
    employees,
  };
}

export async function readEmployeesFile() {
  try {
    const raw = await fs.readFile(EMPLOYEES_PATH, 'utf-8');
    return normalizeRoster(JSON.parse(raw));
  } catch {
    try {
      const raw = await fs.readFile(LEGACY_DRIVERS_PATH, 'utf-8');
      return normalizeRoster(JSON.parse(raw));
    } catch {
      return { companyId: 'company-1', companyName: 'Company', employees: [] };
    }
  }
}

export async function writeEmployeesFile(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const normalized = normalizeRoster(data);
  await fs.writeFile(EMPLOYEES_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
}

export function parseEmployeesCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      errors: ['CSV must include a header row and at least one employee row.'],
      employees: [],
      summary: { totalRows: 0, validEmployees: 0 },
    };
  }

  const headers = splitCsvLine(lines[0]);
  const clockIndex = resolveHeaderIndex(headers, ['clockNumber', 'clock', 'clockno', 'clockid']);
  const nameIndex = resolveHeaderIndex(headers, [
    'name',
    'employeeName',
    'driverName',
    'fullname',
  ]);

  const errors = [];
  if (clockIndex < 0) errors.push('Missing required clock number column.');
  if (nameIndex < 0) errors.push('Missing required name column.');
  if (errors.length > 0) {
    return {
      errors,
      employees: [],
      summary: { totalRows: lines.length - 1, validEmployees: 0 },
    };
  }

  const employees = [];
  const seenClockNumbers = new Set();

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const row = splitCsvLine(lines[rowIndex]);
    const rawClockNumber = row[clockIndex] ?? '';
    const rawName = row[nameIndex] ?? '';

    const clockNumber = rawClockNumber.replace(/\s+/g, '');
    const name = rawName.trim();

    if (!clockNumber || !name) {
      errors.push(`Row ${rowIndex + 1}: clock number and name are required.`);
      continue;
    }

    if (!/^[a-zA-Z0-9]+$/.test(clockNumber)) {
      errors.push(
        `Row ${rowIndex + 1}: invalid clock number "${rawClockNumber}". Use letters/numbers only.`,
      );
      continue;
    }

    if (seenClockNumbers.has(clockNumber)) {
      errors.push(`Row ${rowIndex + 1}: duplicate clock number "${clockNumber}" in CSV.`);
      continue;
    }

    seenClockNumbers.add(clockNumber);
    employees.push({ clockNumber, name });
  }

  return {
    errors,
    employees,
    summary: {
      totalRows: lines.length - 1,
      validEmployees: employees.length,
    },
  };
}

export async function importEmployeesFromCsv({
  csvText,
  companyId,
  companyName,
  replaceExisting = true,
}) {
  const current = await readEmployeesFile();
  const parsed = parseEmployeesCsv(csvText);

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      ...parsed,
      companyId: companyId ?? current.companyId,
      companyName: companyName ?? current.companyName,
    };
  }

  const nextEmployees = replaceExisting
    ? parsed.employees
    : [...current.employees, ...parsed.employees];

  const duplicateExisting = [];
  const dedupeCheck = new Set();
  for (const employee of nextEmployees) {
    if (dedupeCheck.has(employee.clockNumber)) {
      duplicateExisting.push(employee.clockNumber);
    }
    dedupeCheck.add(employee.clockNumber);
  }

  if (duplicateExisting.length > 0) {
    return {
      ok: false,
      errors: [`Duplicate clock numbers after import: ${duplicateExisting.join(', ')}`],
      employees: parsed.employees,
      summary: parsed.summary,
      companyId: companyId ?? current.companyId,
      companyName: companyName ?? current.companyName,
    };
  }

  const nextData = {
    companyId: companyId?.trim() || current.companyId,
    companyName: companyName?.trim() || current.companyName,
    employees: nextEmployees,
  };

  await writeEmployeesFile(nextData);

  return {
    ok: true,
    errors: [],
    employees: parsed.employees,
    summary: {
      ...parsed.summary,
      finalEmployeeCount: nextData.employees.length,
      replacedExisting: replaceExisting,
    },
    companyId: nextData.companyId,
    companyName: nextData.companyName,
  };
}

export function buildEmployeesCsvTemplate() {
  return ['clockNumber,name', '1001,Alex Rivera', '1002,Jordan Lee'].join('\n');
}
