import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEmployeeOne,
  clearStoredAdminKey,
  deleteEmployeeOne,
  downloadEmployeesTemplate,
  downloadSessionsCsv,
  fetchAdminSessions,
  fetchAdminSettings,
  fetchAuditLogs,
  fetchEmployeeRoster,
  fetchNotifications,
  getStoredAdminKey,
  importEmployeesCsv,
  markAllNotificationsRead,
  markNotificationRead,
  previewEmployeesImport,
  removeAdminLogo,
  saveBrandingColors,
  saveSitesList,
  type AdminNotification,
  type AdminSessionRow,
  type AdminSettings,
  type AuditLogRow,
  type EmployeeImportPreview,
  type EmployeeRow,
  updateEmployeeOne,
  uploadAdminLogo,
  verifyAdminKey,
} from './adminApi';
import { useAppConfig } from './hooks/useAppConfig';
import './index.css';

type AdminTab = 'notifications' | 'sessions' | 'employees' | 'settings' | 'audit';

function SiteFilter({
  id,
  value,
  sites,
  onChange,
}: {
  id: string;
  value: string;
  sites: string[];
  onChange: (site: string) => void;
}) {
  return (
    <label className="site-filter" htmlFor={id}>
      Site / depot
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All sites</option>
        {sites.map((site) => (
          <option key={site} value={site}>
            {site}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminApp() {
  const { config } = useAppConfig();
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(Boolean(getStoredAdminKey()));
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<AdminTab>('notifications');
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadRedCount, setUnreadRedCount] = useState(0);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const [siteFilterNotifications, setSiteFilterNotifications] = useState('all');
  const [siteFilterSessions, setSiteFilterSessions] = useState('all');
  const [siteFilterEmployees, setSiteFilterEmployees] = useState('all');
  const [availableSites, setAvailableSites] = useState<string[]>([]);

  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [roster, setRoster] = useState<EmployeeRow[]>([]);
  const [newClock, setNewClock] = useState('');
  const [newName, setNewName] = useState('');
  const [newSite, setNewSite] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [editingClock, setEditingClock] = useState<string | null>(null);
  const [editClock, setEditClock] = useState('');
  const [editName, setEditName] = useState('');
  const [editSite, setEditSite] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [rosterError, setRosterError] = useState('');

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#0c2340');
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [targetColor, setTargetColor] = useState('#ef4444');
  const [managedSites, setManagedSites] = useState<string[]>([]);
  const [newManagedSite, setNewManagedSite] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditError, setAuditError] = useState('');

  const siteOptions = useMemo(() => {
    const fromConfig = config.sites ?? [];
    return [...new Set([...availableSites, ...fromConfig, ...managedSites])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [availableSites, config.sites, managedSites]);

  const refreshNotifications = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const data = await fetchNotifications(false, siteFilterNotifications);
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setUnreadRedCount(data.unreadRedCount ?? 0);
    if (data.sites?.length) {
      setAvailableSites((prev) => [...new Set([...prev, ...data.sites])].sort((a, b) => a.localeCompare(b)));
    }
  }, [siteFilterNotifications]);

  const refreshSessions = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const data = await fetchAdminSessions(flaggedOnly, siteFilterSessions);
    setSessions(data.sessions);
    if (data.sites?.length) {
      setAvailableSites((prev) => [...new Set([...prev, ...data.sites])].sort((a, b) => a.localeCompare(b)));
    }
  }, [flaggedOnly, siteFilterSessions]);

  const refreshRoster = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const data = await fetchEmployeeRoster(siteFilterEmployees);
    setRoster(data.employees);
    if (data.sites?.length) {
      setAvailableSites((prev) => [...new Set([...prev, ...data.sites])].sort((a, b) => a.localeCompare(b)));
    }
  }, [siteFilterEmployees]);

  const refreshAudit = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const data = await fetchAuditLogs(200);
    setAuditLogs(data.logs);
  }, []);

  useEffect(() => {
    if (!authed) return;
    refreshNotifications().catch(() => setAuthed(false));
    const id = window.setInterval(() => {
      refreshNotifications().catch(() => {});
    }, 8000);
    return () => window.clearInterval(id);
  }, [authed, refreshNotifications]);

  useEffect(() => {
    if (!authed || tab !== 'sessions') return;
    refreshSessions().catch(() => {});
  }, [authed, tab, flaggedOnly, siteFilterSessions, refreshSessions]);

  useEffect(() => {
    if (!authed || tab !== 'employees') return;
    refreshRoster().catch(() => {});
  }, [authed, tab, siteFilterEmployees, refreshRoster]);

  useEffect(() => {
    if (!authed || tab !== 'audit') return;
    setAuditError('');
    refreshAudit().catch((err) => {
      setAuditError(err instanceof Error ? err.message : 'Failed to load audit log');
    });
  }, [authed, tab, refreshAudit]);

  useEffect(() => {
    if (!authed || tab !== 'settings') return;
    setSettingsError('');
    fetchAdminSettings()
      .then((s) => {
        setSettings(s);
        setPrimaryColor(s.branding.primaryColor);
        setAccentColor(s.branding.accentColor);
        setTargetColor(s.branding.targetColor);
        setManagedSites(s.sites ?? []);
      })
      .catch((err) => {
        setSettingsError(err instanceof Error ? err.message : 'Failed to load settings');
      });
  }, [authed, tab]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    const ok = await verifyAdminKey(keyInput.trim());
    setLoading(false);
    if (!ok) {
      setLoginError('Invalid admin key');
      return;
    }
    setAuthed(true);
  }

  function handleLogout() {
    clearStoredAdminKey();
    setAuthed(false);
    setKeyInput('');
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    await refreshNotifications();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await refreshNotifications();
  }

  async function handleCsvFile(file: File | null) {
    setImportMessage('');
    setImportError('');
    setPreview(null);
    if (!file) {
      setCsvText('');
      setCsvFileName('');
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setCsvFileName(file.name);
  }

  async function handlePreview() {
    setImportBusy(true);
    setImportMessage('');
    setImportError('');
    try {
      const result = await previewEmployeesImport(csvText);
      setPreview(result);
      if (!result.ok) {
        setImportError(result.errors.join(' '));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImport() {
    setImportBusy(true);
    setImportMessage('');
    setImportError('');
    try {
      const result = await importEmployeesCsv({
        csvText,
        replaceExisting,
        companyName: config.clientCompanyName || undefined,
      });
      if (!result.ok) {
        setImportError(result.errors.join(' ') || 'Import failed');
        setPreview({
          ok: false,
          errors: result.errors,
          summary: result.summary,
          preview: [],
        });
        return;
      }
      setImportMessage(
        `Imported ${result.summary.validEmployees} employees. Roster size: ${result.summary.finalEmployeeCount}.`,
      );
      setPreview(null);
      setCsvText('');
      setCsvFileName('');
      await refreshRoster();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddMessage('');
    setAddError('');
    try {
      const result = await addEmployeeOne({
        clockNumber: newClock.trim(),
        name: newName.trim(),
        site: newSite.trim(),
      });
      setAddMessage(
        `Added ${result.employee.name} (#${result.employee.clockNumber})${
          result.employee.site ? ` · ${result.employee.site}` : ''
        }.`,
      );
      setNewClock('');
      setNewName('');
      setNewSite('');
      await refreshRoster();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add employee');
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(employee: EmployeeRow) {
    setEditingClock(employee.clockNumber);
    setEditClock(employee.clockNumber);
    setEditName(employee.name);
    setEditSite(employee.site ?? '');
    setRosterMessage('');
    setRosterError('');
  }

  function cancelEdit() {
    setEditingClock(null);
    setEditBusy(false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClock) return;
    setEditBusy(true);
    setRosterMessage('');
    setRosterError('');
    try {
      const result = await updateEmployeeOne(editingClock, {
        name: editName.trim(),
        site: editSite.trim(),
        newClockNumber: editClock.trim(),
      });
      setRosterMessage(`Updated ${result.employee.name} (#${result.employee.clockNumber}).`);
      setEditingClock(null);
      await refreshRoster();
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not update employee');
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDeleteEmployee(employee: EmployeeRow) {
    const ok = window.confirm(
      `Delete ${employee.name} (#${employee.clockNumber}) from the roster? Past sessions stay in history.`,
    );
    if (!ok) return;
    setRosterMessage('');
    setRosterError('');
    try {
      await deleteEmployeeOne(employee.clockNumber);
      if (editingClock === employee.clockNumber) setEditingClock(null);
      setRosterMessage(`Deleted ${employee.name} (#${employee.clockNumber}).`);
      await refreshRoster();
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Could not delete employee');
    }
  }

  async function handleSaveColors(e: React.FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const result = await saveBrandingColors({ primaryColor, accentColor, targetColor });
      setSettings((prev) => (prev ? { ...prev, branding: result.branding } : prev));
      setSettingsMessage('Colours saved. Refresh the operator screen to see updates.');
      document.documentElement.style.setProperty('--brand-primary', result.branding.primaryColor);
      document.documentElement.style.setProperty('--accent', result.branding.accentColor);
      document.documentElement.style.setProperty('--target', result.branding.targetColor);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not save colours');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    setSettingsBusy(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const result = await uploadAdminLogo(file);
      setSettings((prev) => (prev ? { ...prev, branding: result.branding } : prev));
      setSettingsMessage('Logo uploaded. Refresh the operator screen to see it.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleLogoRemove() {
    setSettingsBusy(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const result = await removeAdminLogo();
      setSettings((prev) => (prev ? { ...prev, branding: result.branding } : prev));
      setSettingsMessage('Logo removed.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not remove logo');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleAddManagedSite(e: React.FormEvent) {
    e.preventDefault();
    const next = newManagedSite.trim();
    if (!next) return;
    const sites = [...new Set([...managedSites, next])].sort((a, b) => a.localeCompare(b));
    setSettingsBusy(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const result = await saveSitesList(sites);
      setManagedSites(result.sites);
      setNewManagedSite('');
      setSettingsMessage('Sites / depots updated.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not save sites');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleRemoveManagedSite(site: string) {
    const sites = managedSites.filter((s) => s !== site);
    setSettingsBusy(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const result = await saveSitesList(sites);
      setManagedSites(result.sites);
      setSettingsMessage(`Removed site “${site}”.`);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not remove site');
    } finally {
      setSettingsBusy(false);
    }
  }

  return (
    <div className="app admin-app">
      <header className="header">
        <div>
          <p className="eyebrow">{config.vendorName} — Admin</p>
          <h1>{config.productName}</h1>
        </div>
        <div className="admin-header-actions">
          <a className="link-btn" href="/">
            Operator screen
          </a>
          {authed ? (
            <button type="button" className="link-btn" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {!authed ? (
        <main className="main card">
          <h2>Supervisor login</h2>
          <p className="muted">
            Enter the admin key from server setup (`ADMIN_API_KEY`). Default install key is{' '}
            <code>ADMIN-API-KEY</code> — change it during customer setup.
          </p>
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            {loginError ? <p className="error">{loginError}</p> : null}
            <button type="submit" disabled={loading || !keyInput.trim()}>
              {loading ? 'Checking…' : 'Enter dashboard'}
            </button>
          </form>
        </main>
      ) : (
        <>
          <div className="admin-tabs">
            <button
              type="button"
              className={tab === 'notifications' ? 'tab active' : 'tab'}
              onClick={() => setTab('notifications')}
            >
              Notifications{' '}
              {unreadRedCount > 0
                ? `(${unreadRedCount} red)`
                : unreadCount > 0
                  ? `(${unreadCount})`
                  : ''}
            </button>
            <button
              type="button"
              className={tab === 'sessions' ? 'tab active' : 'tab'}
              onClick={() => setTab('sessions')}
            >
              Sessions
            </button>
            <button
              type="button"
              className={tab === 'employees' ? 'tab active' : 'tab'}
              onClick={() => setTab('employees')}
            >
              Employees
            </button>
            <button
              type="button"
              className={tab === 'settings' ? 'tab active' : 'tab'}
              onClick={() => setTab('settings')}
            >
              Settings
            </button>
            <button
              type="button"
              className={tab === 'audit' ? 'tab active' : 'tab'}
              onClick={() => setTab('audit')}
            >
              Audit
            </button>
          </div>

          {tab === 'notifications' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Session notifications</h2>
                <div className="admin-toolbar-actions">
                  <SiteFilter
                    id="notif-site"
                    value={siteFilterNotifications}
                    sites={siteOptions}
                    onChange={setSiteFilterNotifications}
                  />
                  {unreadCount > 0 ? (
                    <button type="button" onClick={handleMarkAllRead}>
                      Mark all read
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="muted tiny">
                Every completed game appears here. <span className="legend-green">Green</span> = under
                4 hits over 800ms and no misses. <span className="legend-red">Red</span> = 4+ hits
                over 800ms, or any missed circle. Refreshes every 8s.
              </p>
              {notifications.length === 0 ? (
                <p className="muted">No notifications yet.</p>
              ) : (
                <ul className="notification-list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`notification severity-${n.severity}${n.readAt ? ' read' : ' unread'}`}
                    >
                      <div className="notification-head">
                        <span className={`severity-badge ${n.severity}`}>
                          {n.severity === 'red' ? 'Review' : 'OK'}
                        </span>
                        <strong>{n.employeeName}</strong>
                        <span className="muted tiny">#{n.clockNumber}</span>
                        {n.site ? <span className="muted tiny">{n.site}</span> : null}
                        <span className="muted tiny">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p>{n.message}</p>
                      <ul>
                        {n.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      {!n.readAt ? (
                        <button type="button" className="small-btn" onClick={() => handleMarkRead(n.id)}>
                          Mark read
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </main>
          ) : null}

          {tab === 'sessions' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Session history</h2>
                <div className="admin-toolbar-actions">
                  <SiteFilter
                    id="sessions-site"
                    value={siteFilterSessions}
                    sites={siteOptions}
                    onChange={setSiteFilterSessions}
                  />
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={flaggedOnly}
                      onChange={(e) => setFlaggedOnly(e.target.checked)}
                    />
                    Flagged only (red)
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadSessionsCsv(flaggedOnly, siteFilterSessions)}
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Employee</th>
                      <th>Clock</th>
                      <th>Site</th>
                      <th>Median</th>
                      <th>Slow hits</th>
                      <th>Hits</th>
                      <th>Misses</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const severity = s.severity ?? (s.shouldAlert ? 'red' : 'green');
                      return (
                        <tr key={s.id} className={severity === 'red' ? 'row-alert' : 'row-ok'}>
                          <td>{new Date(s.createdAt).toLocaleString()}</td>
                          <td>{s.employeeName}</td>
                          <td>{s.clockNumber}</td>
                          <td>{s.site || '—'}</td>
                          <td>
                            {s.sessionMedianMs != null ? `${Math.round(s.sessionMedianMs)} ms` : '—'}
                          </td>
                          <td>{s.slowHits ?? '—'}</td>
                          <td>{s.clicks.length}</td>
                          <td>{s.misses}</td>
                          <td>
                            <span className={`severity-badge ${severity}`}>
                              {severity === 'red' ? 'Red' : 'Green'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </main>
          ) : null}

          {tab === 'employees' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Employees</h2>
                <div className="admin-toolbar-actions">
                  <SiteFilter
                    id="employees-site"
                    value={siteFilterEmployees}
                    sites={siteOptions}
                    onChange={setSiteFilterEmployees}
                  />
                  <button type="button" className="link-btn" onClick={() => downloadEmployeesTemplate()}>
                    Download CSV template
                  </button>
                </div>
              </div>

              <div className="settings-block">
                <h3 className="section-title">Add one employee</h3>
                <form className="add-employee-form" onSubmit={handleAddEmployee}>
                  <label>
                    Clock number
                    <input
                      value={newClock}
                      onChange={(e) => setNewClock(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label>
                    Name
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label>
                    Site / depot
                    <input
                      list="site-suggestions"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      autoComplete="off"
                      placeholder="Optional"
                    />
                  </label>
                  <datalist id="site-suggestions">
                    {siteOptions.map((site) => (
                      <option key={site} value={site} />
                    ))}
                  </datalist>
                  <button type="submit" disabled={addBusy || !newClock.trim() || !newName.trim()}>
                    {addBusy ? 'Adding…' : 'Add employee'}
                  </button>
                </form>
                {addMessage ? <p className="success">{addMessage}</p> : null}
                {addError ? <p className="error">{addError}</p> : null}
              </div>

              <div className="settings-block">
                <h3 className="section-title">Current roster ({roster.length})</h3>
                {rosterMessage ? <p className="success">{rosterMessage}</p> : null}
                {rosterError ? <p className="error">{rosterError}</p> : null}
                {roster.length === 0 ? (
                  <p className="muted">No employees yet. Add one above or import a CSV below.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Clock</th>
                          <th>Name</th>
                          <th>Site</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((employee) =>
                          editingClock === employee.clockNumber ? (
                            <tr key={employee.clockNumber} className="row-editing">
                              <td colSpan={4}>
                                <form className="edit-employee-form" onSubmit={handleSaveEdit}>
                                  <label>
                                    Clock
                                    <input
                                      value={editClock}
                                      onChange={(e) => setEditClock(e.target.value)}
                                      required
                                    />
                                  </label>
                                  <label>
                                    Name
                                    <input
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      required
                                    />
                                  </label>
                                  <label>
                                    Site
                                    <input
                                      list="site-suggestions"
                                      value={editSite}
                                      onChange={(e) => setEditSite(e.target.value)}
                                    />
                                  </label>
                                  <div className="row-actions">
                                    <button type="submit" disabled={editBusy}>
                                      {editBusy ? 'Saving…' : 'Save'}
                                    </button>
                                    <button type="button" className="link-btn" onClick={cancelEdit}>
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          ) : (
                            <tr key={employee.clockNumber}>
                              <td>{employee.clockNumber}</td>
                              <td>{employee.name}</td>
                              <td>{employee.site || '—'}</td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="small-btn"
                                    onClick={() => startEdit(employee)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="small-btn danger"
                                    onClick={() => handleDeleteEmployee(employee)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="settings-block">
                <h3 className="section-title">Bulk CSV import</h3>
                <p className="muted">
                  Upload a CSV with columns <code>clockNumber</code>, <code>name</code>, and optional{' '}
                  <code>site</code> (or <code>depot</code>). Preview first, then apply to replace or
                  append the roster.
                </p>

                <div className="import-panel">
                  <label className="file-label" htmlFor="employees-csv">
                    Choose CSV file
                  </label>
                  <input
                    id="employees-csv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                  />
                  {csvFileName ? <p className="muted tiny">Selected: {csvFileName}</p> : null}

                  <label className="checkbox-inline import-option">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                    />
                    Replace existing roster (unchecked = append)
                  </label>

                  <div className="admin-toolbar-actions">
                    <button type="button" disabled={!csvText || importBusy} onClick={handlePreview}>
                      {importBusy ? 'Working…' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      disabled={!csvText || importBusy || (preview != null && !preview.ok)}
                      onClick={handleImport}
                    >
                      Apply import
                    </button>
                  </div>

                  {importMessage ? <p className="success">{importMessage}</p> : null}
                  {importError ? <p className="error">{importError}</p> : null}

                  {preview ? (
                    <div className="import-preview">
                      <p className="muted tiny">
                        Rows: {preview.summary.totalRows} · Valid: {preview.summary.validEmployees}
                        {preview.ok ? ' · Ready to import' : ' · Fix errors before importing'}
                      </p>
                      {preview.errors.length > 0 ? (
                        <ul className="error-list">
                          {preview.errors.slice(0, 12).map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                          {preview.errors.length > 12 ? (
                            <li>…and {preview.errors.length - 12} more</li>
                          ) : null}
                        </ul>
                      ) : null}
                      {preview.preview.length > 0 ? (
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Clock</th>
                                <th>Name</th>
                                <th>Site</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.preview.map((d) => (
                                <tr key={d.clockNumber}>
                                  <td>{d.clockNumber}</td>
                                  <td>{d.name}</td>
                                  <td>{d.site || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.summary.validEmployees > preview.preview.length ? (
                            <p className="muted tiny">Showing first {preview.preview.length} rows.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </main>
          ) : null}

          {tab === 'settings' ? (
            <main className="main card">
              <h2>Branding settings</h2>
              <p className="muted">
                Upload your logo and choose colours after purchase. Company name is set by IT during
                hosting setup and cannot be changed here.
              </p>

              <div className="settings-block">
                <label className="file-label">Company name (IT only)</label>
                <input
                  type="text"
                  value={settings?.companyName ?? config.clientCompanyName ?? ''}
                  disabled
                  readOnly
                />
                <p className="muted tiny">
                  {settings?.companyNameHint ??
                    'Ask IT to set COMPANY_NAME in the server .env / install config.'}
                </p>
              </div>

              <div className="settings-block">
                <label className="file-label">Sites / depots</label>
                <p className="muted tiny">
                  Used for employee assignment and filtering notifications/sessions. Employees can
                  also introduce new site names when added or imported.
                </p>
                {managedSites.length === 0 ? (
                  <p className="muted tiny">No sites configured yet.</p>
                ) : (
                  <ul className="site-chip-list">
                    {managedSites.map((site) => (
                      <li key={site}>
                        <span>{site}</span>
                        <button
                          type="button"
                          className="link-btn"
                          disabled={settingsBusy}
                          onClick={() => handleRemoveManagedSite(site)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form className="add-employee-form" onSubmit={handleAddManagedSite}>
                  <label>
                    Add site
                    <input
                      value={newManagedSite}
                      onChange={(e) => setNewManagedSite(e.target.value)}
                      placeholder="e.g. Main Depot"
                      autoComplete="off"
                    />
                  </label>
                  <button type="submit" disabled={settingsBusy || !newManagedSite.trim()}>
                    Add site
                  </button>
                </form>
              </div>

              <div className="settings-block">
                <label className="file-label">Logo</label>
                {settings?.branding.logoUrl ? (
                  <div className="logo-preview-row">
                    <img
                      src={`${settings.branding.logoUrl}?t=${Date.now()}`}
                      alt="Company logo"
                      className="settings-logo-preview"
                    />
                    <button
                      type="button"
                      className="link-btn"
                      disabled={settingsBusy}
                      onClick={handleLogoRemove}
                    >
                      Remove logo
                    </button>
                  </div>
                ) : (
                  <p className="muted tiny">No logo uploaded yet.</p>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  disabled={settingsBusy}
                  onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                />
              </div>

              <form className="settings-block" onSubmit={handleSaveColors}>
                <label className="file-label">Brand colours</label>
                <div className="color-grid">
                  <label>
                    Primary
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                  </label>
                  <label>
                    Accent
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                  </label>
                  <label>
                    Target bubbles
                    <input
                      type="color"
                      value={targetColor}
                      onChange={(e) => setTargetColor(e.target.value)}
                    />
                    <input
                      type="text"
                      value={targetColor}
                      onChange={(e) => setTargetColor(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" disabled={settingsBusy}>
                  {settingsBusy ? 'Saving…' : 'Save colours'}
                </button>
              </form>

              {settingsMessage ? <p className="success">{settingsMessage}</p> : null}
              {settingsError ? <p className="error">{settingsError}</p> : null}
            </main>
          ) : null}

          {tab === 'audit' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Audit log</h2>
                <button type="button" className="link-btn" onClick={() => refreshAudit()}>
                  Refresh
                </button>
              </div>
              <p className="muted tiny">
                Records admin roster changes, branding updates, and completed sessions.
              </p>
              {auditError ? <p className="error">{auditError}</p> : null}
              {auditLogs.length === 0 ? (
                <p className="muted">No audit entries yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>IP</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.createdAt).toLocaleString()}</td>
                          <td>
                            <code>{log.action}</code>
                          </td>
                          <td>{log.actor}</td>
                          <td>{log.ip || '—'}</td>
                          <td className="audit-details">
                            <code>{JSON.stringify(log.details)}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </main>
          ) : null}
        </>
      )}
    </div>
  );
}
