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
  const employees = (data.employees ?? data.drivers ?? []).map((e) => ({
    clockNumber: String(e.clockNumber),
    name: String(e.name),
    site: String(e.site ?? e.depot ?? '').trim(),
  }));
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
  const siteIndex = resolveHeaderIndex(headers, ['site', 'depot', 'location', 'yard']);

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
    const rawSite = siteIndex >= 0 ? row[siteIndex] ?? '' : '';

    const clockNumber = rawClockNumber.replace(/\s+/g, '');
    const name = rawName.trim();
    const site = String(rawSite).trim();

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
    employees.push({ clockNumber, name, site });
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

export async function addEmployee({ clockNumber, name, site = '' }) {
  const current = await readEmployeesFile();
  const normalizedClock = String(clockNumber ?? '').replace(/\s+/g, '');
  const normalizedName = String(name ?? '').trim();
  const normalizedSite = String(site ?? '').trim();

  if (!normalizedClock || !normalizedName) {
    return { ok: false, error: 'Clock number and name are required' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(normalizedClock)) {
    return { ok: false, error: 'Clock number must use letters and numbers only' };
  }
  if (current.employees.some((e) => e.clockNumber === normalizedClock)) {
    return { ok: false, error: `Clock number ${normalizedClock} already exists` };
  }

  const employee = {
    clockNumber: normalizedClock,
    name: normalizedName,
    site: normalizedSite,
  };
  const nextData = {
    ...current,
    employees: [...current.employees, employee],
  };
  await writeEmployeesFile(nextData);

  return {
    ok: true,
    employee,
    employeeCount: nextData.employees.length,
  };
}

export async function updateEmployee(clockNumber, { name, site, newClockNumber }) {
  const current = await readEmployeesFile();
  const key = String(clockNumber ?? '').replace(/\s+/g, '');
  const index = current.employees.findIndex((e) => e.clockNumber === key);
  if (index < 0) {
    return { ok: false, error: 'Employee not found' };
  }

  const existing = current.employees[index];
  const nextClock = String(newClockNumber ?? existing.clockNumber).replace(/\s+/g, '');
  const nextName = name != null ? String(name).trim() : existing.name;
  const nextSite = site != null ? String(site).trim() : existing.site ?? '';

  if (!nextClock || !nextName) {
    return { ok: false, error: 'Clock number and name are required' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(nextClock)) {
    return { ok: false, error: 'Clock number must use letters and numbers only' };
  }
  if (
    nextClock !== key &&
    current.employees.some((e) => e.clockNumber === nextClock)
  ) {
    return { ok: false, error: `Clock number ${nextClock} already exists` };
  }

  const employee = { clockNumber: nextClock, name: nextName, site: nextSite };
  const employees = [...current.employees];
  employees[index] = employee;
  await writeEmployeesFile({ ...current, employees });

  return { ok: true, employee, employeeCount: employees.length };
}

export async function deleteEmployee(clockNumber) {
  const current = await readEmployeesFile();
  const key = String(clockNumber ?? '').replace(/\s+/g, '');
  const existing = current.employees.find((e) => e.clockNumber === key);
  if (!existing) {
    return { ok: false, error: 'Employee not found' };
  }

  const employees = current.employees.filter((e) => e.clockNumber !== key);
  await writeEmployeesFile({ ...current, employees });
  return { ok: true, deleted: existing, employeeCount: employees.length };
}

export async function listEmployees({ site } = {}) {
  const data = await readEmployeesFile();
  let employees = [...data.employees];
  if (site && site !== 'all') {
    employees = employees.filter((e) => (e.site || '') === site);
  }
  employees.sort((a, b) =>
    a.clockNumber.localeCompare(b.clockNumber, undefined, { numeric: true }),
  );

  const sites = [
    ...new Set(data.employees.map((e) => e.site).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    companyId: data.companyId,
    companyName: data.companyName,
    employees,
    employeeCount: employees.length,
    sites,
  };
}

export function buildEmployeesCsvTemplate() {
  return ['clockNumber,name,site', 'E1001,Example Name,Main Depot', 'E1002,Example Name,North Yard'].join(
    '\n',
  );
}
