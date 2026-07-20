import { useEffect, useState } from 'react';
import { fetchPublicConfig, type PublicAppConfig } from '../api';

const DEFAULT_CONFIG: PublicAppConfig = {
  vendorName: 'Delano Solutions',
  productName: 'ShiftSmart Fatigue Check',
  clientCompanyName: '',
  supportEmail: '',
  supportPhone: '',
  branding: {
    primaryColor: '#0c2340',
    accentColor: '#3b82f6',
    targetColor: '#ef4444',
    logoUrl: null,
  },
  disclaimer: '',
  kioskMode: false,
  kioskResultsSeconds: 12,
  kioskRequireExitPin: false,
};

function applyBranding(config: PublicAppConfig) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', config.branding.primaryColor);
  root.style.setProperty('--accent', config.branding.accentColor);
  root.style.setProperty('--target', config.branding.targetColor);
  document.title = `${config.productName} — ${config.clientCompanyName || config.vendorName}`;
}

export function useAppConfig() {
  const [config, setConfig] = useState<PublicAppConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchPublicConfig()
      .then((c) => {
        setConfig(c);
        applyBranding(c);
      })
      .catch(() => applyBranding(DEFAULT_CONFIG))
      .finally(() => setReady(true));
  }, []);

  return { config, ready };
}
