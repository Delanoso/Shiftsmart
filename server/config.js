import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPANY_PATH = path.join(__dirname, '..', 'data', 'company.json');

const DEFAULTS = {
  vendorName: 'Delano Solutions',
  productName: 'ShiftSmart Fatigue Check',
  clientCompanyId: 'company-1',
  clientCompanyName: 'Company',
  supportEmail: '',
  supportPhone: '',
  branding: {
    primaryColor: '#0c2340',
    accentColor: '#3b82f6',
    targetColor: '#ef4444',
    logoPath: '',
  },
  disclaimer:
    'This check is an operational screening aid only. It does not replace medical assessment or your company fitness-for-work policies.',
  sites: [],
};

function envOr(value, envKey) {
  const fromEnv = process.env[envKey]?.trim();
  return fromEnv || value;
}

function envBool(value, envKey, defaultValue = false) {
  const fromEnv = process.env[envKey]?.trim().toLowerCase();
  if (fromEnv === 'true' || fromEnv === '1') return true;
  if (fromEnv === 'false' || fromEnv === '0') return false;
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

function envInt(value, envKey, defaultValue) {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv && !Number.isNaN(Number(fromEnv))) return Number(fromEnv);
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  return defaultValue;
}

function fileFirst(fileValue, envKey, defaultValue = '') {
  if (fileValue != null && String(fileValue).trim() !== '') {
    return String(fileValue).trim();
  }
  return envOr(defaultValue, envKey);
}

export async function loadCompanyConfig() {
  let fileConfig = {};
  try {
    const raw = await fs.readFile(COMPANY_PATH, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch {
    fileConfig = {};
  }

  const branding = {
    ...DEFAULTS.branding,
    ...(fileConfig.branding ?? {}),
  };

  const merged = {
    vendorName: envOr(fileConfig.vendorName ?? DEFAULTS.vendorName, 'VENDOR_NAME'),
    productName: envOr(fileConfig.productName ?? DEFAULTS.productName, 'PRODUCT_NAME'),
    clientCompanyId: envOr(fileConfig.clientCompanyId ?? DEFAULTS.clientCompanyId, 'COMPANY_ID'),
    // Company name is IT-controlled (env preferred over file during hosting setup)
    clientCompanyName: envOr(
      fileConfig.clientCompanyName ?? DEFAULTS.clientCompanyName,
      'COMPANY_NAME',
    ),
    supportEmail: envOr(fileConfig.supportEmail ?? '', 'SUPPORT_EMAIL'),
    supportPhone: envOr(fileConfig.supportPhone ?? '', 'SUPPORT_PHONE'),
    branding: {
      // Branding can be managed in Admin Settings (file wins over env)
      primaryColor: fileFirst(branding.primaryColor, 'BRAND_PRIMARY', DEFAULTS.branding.primaryColor),
      accentColor: fileFirst(branding.accentColor, 'BRAND_ACCENT', DEFAULTS.branding.accentColor),
      targetColor: fileFirst(branding.targetColor, 'BRAND_TARGET', DEFAULTS.branding.targetColor),
      logoPath: fileFirst(branding.logoPath ?? '', 'LOGO_PATH', ''),
    },
    disclaimer: envOr(fileConfig.disclaimer ?? DEFAULTS.disclaimer, 'DISCLAIMER'),
    kioskMode: envBool(fileConfig.kioskMode, 'KIOSK_MODE', false),
    kioskResultsSeconds: envInt(fileConfig.kioskResultsSeconds, 'KIOSK_RESULTS_SECONDS', 12),
    kioskRequireExitPin: envBool(fileConfig.kioskRequireExitPin, 'KIOSK_REQUIRE_EXIT_PIN', true),
    sites: Array.isArray(fileConfig.sites)
      ? fileConfig.sites.map((s) => String(s).trim()).filter(Boolean)
      : [],
  };

  return merged;
}

/** Public fields safe to expose to the browser */
export function toPublicConfig(config) {
  const logoPath = config.branding.logoPath?.trim();
  return {
    vendorName: config.vendorName,
    productName: config.productName,
    clientCompanyName: config.clientCompanyName,
    supportEmail: config.supportEmail,
    supportPhone: config.supportPhone,
    branding: {
      primaryColor: config.branding.primaryColor,
      accentColor: config.branding.accentColor,
      targetColor: config.branding.targetColor,
      logoUrl: logoPath ? (logoPath.startsWith('/') ? logoPath : `/${logoPath}`) : null,
    },
    disclaimer: config.disclaimer,
    kioskMode: config.kioskMode,
    kioskResultsSeconds: config.kioskResultsSeconds,
    kioskRequireExitPin: Boolean(process.env.KIOSK_EXIT_PIN) && config.kioskRequireExitPin,
    sites: config.sites ?? [],
  };
}

export async function readCompanyFile() {
  try {
    const raw = await fs.readFile(COMPANY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULTS, branding: { ...DEFAULTS.branding } };
  }
}

export async function writeCompanyFile(data) {
  await fs.mkdir(path.dirname(COMPANY_PATH), { recursive: true });
  await fs.writeFile(COMPANY_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function isHexColor(value) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value ?? '').trim());
}

/** Update branding only — company name is not editable here (IT hosting setup). */
export async function updateBrandingSettings({
  primaryColor,
  accentColor,
  targetColor,
  logoPath,
}) {
  const current = await readCompanyFile();
  const branding = {
    ...(current.branding ?? DEFAULTS.branding),
  };

  if (primaryColor != null) {
    if (!isHexColor(primaryColor)) throw new Error('primaryColor must be a hex colour like #0c2340');
    branding.primaryColor = primaryColor.trim();
  }
  if (accentColor != null) {
    if (!isHexColor(accentColor)) throw new Error('accentColor must be a hex colour like #3b82f6');
    branding.accentColor = accentColor.trim();
  }
  if (targetColor != null) {
    if (!isHexColor(targetColor)) throw new Error('targetColor must be a hex colour like #ef4444');
    branding.targetColor = targetColor.trim();
  }
  if (logoPath !== undefined) {
    branding.logoPath = logoPath ?? '';
  }

  const next = { ...current, branding };
  await writeCompanyFile(next);
  return loadCompanyConfig();
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export async function saveUploadedLogo({ filename, base64Data }) {
  const safeName = String(filename ?? 'client-logo.png')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
  const ext = path.extname(safeName) || '.png';
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);
  if (!allowed.has(ext)) {
    throw new Error('Logo must be png, jpg, jpeg, webp, svg, or gif');
  }

  let payload = String(base64Data ?? '');
  const dataUrlMatch = payload.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (dataUrlMatch) payload = dataUrlMatch[1];

  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length) throw new Error('Logo file is empty');
  if (buffer.length > 2_500_000) throw new Error('Logo must be under 2.5MB');

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  const outName = `client-logo${ext}`;
  await fs.writeFile(path.join(PUBLIC_DIR, outName), buffer);
  return updateBrandingSettings({ logoPath: outName });
}

export async function clearUploadedLogo() {
  const current = await loadCompanyConfig();
  const logoPath = current.branding.logoPath;
  if (logoPath) {
    const file = path.join(PUBLIC_DIR, path.basename(logoPath));
    try {
      await fs.unlink(file);
    } catch {
      // ignore missing file
    }
  }
  return updateBrandingSettings({ logoPath: '' });
}

export async function updateSites(sites) {
  if (!Array.isArray(sites)) throw new Error('sites must be an array');
  const cleaned = [
    ...new Set(sites.map((s) => String(s).trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const current = await readCompanyFile();
  await writeCompanyFile({ ...current, sites: cleaned });
  return loadCompanyConfig();
}

export async function syncEmployeesCompanyMeta() {
  const config = await loadCompanyConfig();
  const employeesPath = path.join(__dirname, '..', 'data', 'employees.json');
  try {
    const raw = await fs.readFile(employeesPath, 'utf-8');
    const roster = JSON.parse(raw);
    const employees = roster.employees ?? roster.drivers ?? [];
    if (
      roster.companyId !== config.clientCompanyId ||
      roster.companyName !== config.clientCompanyName ||
      roster.drivers
    ) {
      const next = {
        companyId: config.clientCompanyId,
        companyName: config.clientCompanyName,
        employees,
      };
      await fs.writeFile(employeesPath, JSON.stringify(next, null, 2), 'utf-8');
    }
  } catch {
    // employees file may not exist yet during first install
  }
  return config;
}
