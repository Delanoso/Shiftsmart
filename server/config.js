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
};

function envOr(value, envKey) {
  const fromEnv = process.env[envKey]?.trim();
  return fromEnv || value;
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
    clientCompanyName: envOr(
      fileConfig.clientCompanyName ?? DEFAULTS.clientCompanyName,
      'COMPANY_NAME',
    ),
    supportEmail: envOr(fileConfig.supportEmail ?? '', 'SUPPORT_EMAIL'),
    supportPhone: envOr(fileConfig.supportPhone ?? '', 'SUPPORT_PHONE'),
    branding: {
      primaryColor: envOr(branding.primaryColor, 'BRAND_PRIMARY'),
      accentColor: envOr(branding.accentColor, 'BRAND_ACCENT'),
      targetColor: envOr(branding.targetColor, 'BRAND_TARGET'),
      logoPath: envOr(branding.logoPath ?? '', 'LOGO_PATH'),
    },
    disclaimer: envOr(fileConfig.disclaimer ?? DEFAULTS.disclaimer, 'DISCLAIMER'),
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
  };
}

export async function syncDriversCompanyMeta() {
  const config = await loadCompanyConfig();
  const driversPath = path.join(__dirname, '..', 'data', 'drivers.json');
  try {
    const raw = await fs.readFile(driversPath, 'utf-8');
    const drivers = JSON.parse(raw);
    if (
      drivers.companyId !== config.clientCompanyId ||
      drivers.companyName !== config.clientCompanyName
    ) {
      drivers.companyId = config.clientCompanyId;
      drivers.companyName = config.clientCompanyName;
      await fs.writeFile(driversPath, JSON.stringify(drivers, null, 2), 'utf-8');
    }
  } catch {
    // drivers file may not exist yet during first install
  }
  return config;
}
