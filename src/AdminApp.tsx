import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredAdminKey,
  downloadEmployeesTemplate,
  downloadSessionsCsv,
  fetchAdminSessions,
  fetchNotifications,
  getStoredAdminKey,
  importEmployeesCsv,
  markAllNotificationsRead,
  markNotificationRead,
  previewEmployeesImport,
  type AdminNotification,
  type AdminSessionRow,
  type EmployeeImportPreview,
  verifyAdminKey,
} from './adminApi';
import { useAppConfig } from './hooks/useAppConfig';
import './index.css';

type AdminTab = 'notifications' | 'sessions' | 'employees';

export default function AdminApp() {
  const { config } = useAppConfig();
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(Boolean(getStoredAdminKey()));
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<AdminTab>('notifications');
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');

  const refreshNotifications = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const data = await fetchNotifications(false);
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!getStoredAdminKey()) return;
    const rows = await fetchAdminSessions(flaggedOnly);
    setSessions(rows);
  }, [flaggedOnly]);

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
  }, [authed, tab, flaggedOnly, refreshSessions]);

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
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportBusy(false);
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
          <p className="muted">Enter the admin key configured on the server (`ADMIN_API_KEY`).</p>
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
              Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
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
          </div>

          {tab === 'notifications' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Fatigue notifications</h2>
                {unreadCount > 0 ? (
                  <button type="button" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                ) : null}
              </div>
              <p className="muted tiny">
                New fatigue flags from operator sessions appear here automatically (refreshes every 8s).
              </p>
              {notifications.length === 0 ? (
                <p className="muted">No notifications yet.</p>
              ) : (
                <ul className="notification-list">
                  {notifications.map((n) => (
                    <li key={n.id} className={n.readAt ? 'notification read' : 'notification unread'}>
                      <div className="notification-head">
                        <strong>{n.employeeName}</strong>
                        <span className="muted tiny">#{n.clockNumber}</span>
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
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={flaggedOnly}
                      onChange={(e) => setFlaggedOnly(e.target.checked)}
                    />
                    Flagged only
                  </label>
                  <button type="button" onClick={() => downloadSessionsCsv(flaggedOnly)}>
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
                      <th>Median</th>
                      <th>Hits</th>
                      <th>Misses</th>
                      <th>Flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className={s.shouldAlert ? 'row-alert' : ''}>
                        <td>{new Date(s.createdAt).toLocaleString()}</td>
                        <td>{s.employeeName}</td>
                        <td>{s.clockNumber}</td>
                        <td>{s.sessionMedianMs != null ? `${Math.round(s.sessionMedianMs)} ms` : '—'}</td>
                        <td>{s.clicks.length}</td>
                        <td>{s.misses}</td>
                        <td>{s.shouldAlert ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </main>
          ) : null}

          {tab === 'employees' ? (
            <main className="main card">
              <div className="admin-toolbar">
                <h2>Import employees</h2>
                <button type="button" className="link-btn" onClick={() => downloadEmployeesTemplate()}>
                  Download CSV template
                </button>
              </div>
              <p className="muted">
                Upload a CSV with columns <code>clockNumber</code> and <code>name</code>. Preview first,
                then apply to replace or append the roster.
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
                            </tr>
                          </thead>
                          <tbody>
                            {preview.preview.map((d) => (
                              <tr key={d.clockNumber}>
                                <td>{d.clockNumber}</td>
                                <td>{d.name}</td>
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
            </main>
          ) : null}
        </>
      )}
    </div>
  );
}
