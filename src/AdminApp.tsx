import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredAdminKey,
  downloadSessionsCsv,
  fetchAdminSessions,
  fetchNotifications,
  getStoredAdminKey,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
  type AdminSessionRow,
  verifyAdminKey,
} from './adminApi';
import { useAppConfig } from './hooks/useAppConfig';
import './index.css';

type AdminTab = 'notifications' | 'sessions';

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
                        <strong>{n.driverName}</strong>
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
          ) : (
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
                      <th>Driver</th>
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
                        <td>{s.driverName}</td>
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
          )}
        </>
      )}
    </div>
  );
}
