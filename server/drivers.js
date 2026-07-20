import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DRIVERS_PATH = path.join(DATA_DIR, 'drivers.json');

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

export async function readDriversFile() {
  try {
    const raw = await fs.readFile(DRIVERS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { companyId: 'company-1', companyName: 'Company', drivers: [] };
  }
}

export async function writeDriversFile(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DRIVERS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function parseDriversCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      errors: ['CSV must include a header row and at least one driver row.'],
      drivers: [],
      summary: { totalRows: 0, validDrivers: 0 },
    };
  }

  const headers = splitCsvLine(lines[0]);
  const clockIndex = resolveHeaderIndex(headers, ['clockNumber', 'clock', 'clockno', 'clockid']);
  const nameIndex = resolveHeaderIndex(headers, ['name', 'driverName', 'fullname']);

  const errors = [];
  if (clockIndex < 0) errors.push('Missing required clock number column.');
  if (nameIndex < 0) errors.push('Missing required name column.');
  if (errors.length > 0) {
    return {
      errors,
      drivers: [],
      summary: { totalRows: lines.length - 1, validDrivers: 0 },
    };
  }

  const drivers = [];
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
      errors.push(`Row ${rowIndex + 1}: invalid clock number "${rawClockNumber}". Use letters/numbers only.`);
      continue;
    }

    if (seenClockNumbers.has(clockNumber)) {
      errors.push(`Row ${rowIndex + 1}: duplicate clock number "${clockNumber}" in CSV.`);
      continue;
    }

    seenClockNumbers.add(clockNumber);
    drivers.push({ clockNumber, name });
  }

  return {
    errors,
    drivers,
    summary: {
      totalRows: lines.length - 1,
      validDrivers: drivers.length,
    },
  };
}

export async function importDriversFromCsv({
  csvText,
  companyId,
  companyName,
  replaceExisting = true,
}) {
  const current = await readDriversFile();
  const parsed = parseDriversCsv(csvText);

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      ...parsed,
      companyId: companyId ?? current.companyId,
      companyName: companyName ?? current.companyName,
    };
  }

  const nextDrivers = replaceExisting
    ? parsed.drivers
    : [...current.drivers, ...parsed.drivers];

  const duplicateExisting = [];
  const dedupeCheck = new Set();
  for (const driver of nextDrivers) {
    if (dedupeCheck.has(driver.clockNumber)) {
      duplicateExisting.push(driver.clockNumber);
    }
    dedupeCheck.add(driver.clockNumber);
  }

  if (duplicateExisting.length > 0) {
    return {
      ok: false,
      errors: [`Duplicate clock numbers after import: ${duplicateExisting.join(', ')}`],
      drivers: parsed.drivers,
      summary: parsed.summary,
      companyId: companyId ?? current.companyId,
      companyName: companyName ?? current.companyName,
    };
  }

  const nextData = {
    companyId: companyId?.trim() || current.companyId,
    companyName: companyName?.trim() || current.companyName,
    drivers: nextDrivers,
  };

  await writeDriversFile(nextData);

  return {
    ok: true,
    errors: [],
    drivers: parsed.drivers,
    summary: {
      ...parsed.summary,
      finalDriverCount: nextData.drivers.length,
      replacedExisting: replaceExisting,
    },
    companyId: nextData.companyId,
    companyName: nextData.companyName,
  };
}

export function buildDriversCsvTemplate() {
  return ['clockNumber,name', '1001,Alex Rivera', '1002,Jordan Lee'].join('\n');
}

