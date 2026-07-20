import { useCallback, useEffect, useState } from 'react';
import { fetchCompany, fetchDriver, submitSession } from './api';
import { useCountdown } from './hooks/useCountdown';
import { useFatigueGame } from './hooks/useFatigueGame';
import {
  GAME_DURATION_MS,
  formatMs,
  type ClickRecord,
  type DriverInfo,
  type ScreenPhase,
  type SessionResult,
} from './types';

function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="instr-title">
      <div className="modal card">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close instructions">
          ×
        </button>
        <h2 id="instr-title">Fatigue reaction check</h2>
        <ul className="instr-list">
          <li>Random circles will appear on the play area for about 30 seconds.</li>
          <li>Tap or click each circle as quickly as you can.</li>
          <li>Smaller circles may be harder — stay focused.</li>
          <li>If you miss a circle, it counts against your score.</li>
          <li>Your reaction times are saved to build your personal and company baseline.</li>
        </ul>
        <p className="muted">Close this window when you are ready. A short countdown will start before the game.</p>
      </div>
    </div>
  );
}

function CountdownOverlay({ value }: { value: number }) {
  return (
    <div className="overlay countdown-overlay">
      <span className="countdown-number" key={value}>
        {value}
      </span>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<ScreenPhase>('login');
  const [clockInput, setClockInput] = useState('');
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loginError, setLoginError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [saveError, setSaveError] = useState('');
  const [gameStartedAt, setGameStartedAt] = useState<string>('');

  useEffect(() => {
    fetchCompany()
      .then((c) => setCompanyName(c.companyName))
      .catch(() => setCompanyName(''));
  }, []);

  const handleInstructionsClosed = () => setPhase('countdown');

  const countdownValue = useCountdown({
    active: phase === 'countdown',
    onDone: useCallback(() => {
      setGameStartedAt(new Date().toISOString());
      setPhase('playing');
    }, []),
  });

  const onGameComplete = useCallback(
    async (clicks: ClickRecord[], misses: number) => {
      if (!driver) return;
      setPhase('results');
      setLoading(true);
      setSaveError('');
      try {
        const result = await submitSession({
          clockNumber: driver.clockNumber,
          durationMs: GAME_DURATION_MS,
          clicks,
          misses,
          startedAt: gameStartedAt || new Date().toISOString(),
          endedAt: new Date().toISOString(),
        });
        setSessionResult(result);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not save results');
      } finally {
        setLoading(false);
      }
    },
    [driver, gameStartedAt],
  );

  const game = useFatigueGame({
    active: phase === 'playing',
    onComplete: onGameComplete,
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const info = await fetchDriver(clockInput);
      setDriver(info);
      setPhase('instructions');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid clock number');
    } finally {
      setLoading(false);
    }
  }

  function handlePlayAgain() {
    setSessionResult(null);
    setSaveError('');
    setPhase('instructions');
  }

  function handleSignOut() {
    setDriver(null);
    setClockInput('');
    setSessionResult(null);
    setSaveError('');
    setPhase('login');
  }

  const secondsLeft = Math.ceil(game.timeLeftMs / 1000);

  return (
    <div className={`app ${phase === 'playing' ? 'playing' : ''}`}>
      <header className="header">
        <div>
          <p className="eyebrow">ShiftSmart</p>
          <h1>Fatigue reaction check</h1>
        </div>
        {companyName ? <span className="company-badge">{companyName}</span> : null}
      </header>

      {phase === 'login' && (
        <main className="main card">
          <h2>Enter your clock number</h2>
          <p className="muted">Your ID links this session to your driver record and baseline history.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="clock">Clock number</label>
            <input
              id="clock"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1001"
              value={clockInput}
              onChange={(e) => setClockInput(e.target.value)}
              disabled={loading}
            />
            {loginError ? <p className="error">{loginError}</p> : null}
            <button type="submit" disabled={loading || !clockInput.trim()}>
              {loading ? 'Looking up…' : 'Continue'}
            </button>
          </form>
          <p className="hint muted">Demo drivers: 1001–1005 (more can be loaded into data/drivers.json).</p>
        </main>
      )}

      {phase !== 'login' && driver ? (
        <div className="driver-bar">
          <span>
            {driver.name} · #{driver.clockNumber}
          </span>
          <button type="button" className="link-btn" onClick={handleSignOut}>
            Switch driver
          </button>
        </div>
      ) : null}

      {phase === 'instructions' ? <InstructionsModal onClose={handleInstructionsClosed} /> : null}
      {phase === 'countdown' && countdownValue != null ? (
        <CountdownOverlay value={countdownValue} />
      ) : null}

      {(phase === 'playing' || phase === 'results') && (
        <section className="game-section">
          <div className="game-hud">
            <span>Time: {secondsLeft}s</span>
            <span>Hits: {game.clicks.length}</span>
            <span>Misses: {game.misses}</span>
          </div>
          <div
            ref={game.areaRef}
            className={`play-area ${phase === 'playing' ? 'active' : 'frozen'}`}
            aria-label="Reaction game play area"
          >
            {phase === 'playing' && game.target ? (
              <button
                type="button"
                className="target"
                style={{
                  width: game.target.size,
                  height: game.target.size,
                  left: game.target.x,
                  top: game.target.y,
                }}
                onClick={(e) => game.handleTargetClick(e, game.target!)}
                aria-label="Reaction target"
              />
            ) : null}
            {phase === 'results' ? <div className="play-area-done">Session complete</div> : null}
          </div>
        </section>
      )}

      {phase === 'results' && (
        <main className="main card results">
          <h2>Your results</h2>
          {loading ? <p>Saving session and updating baselines…</p> : null}
          {saveError ? <p className="error">{saveError}</p> : null}
          {sessionResult ? (
            <>
              <div className="stats-grid">
                <div>
                  <p className="stat-label">This session (median)</p>
                  <p className="stat-value">
                    {formatMs(sessionResult.evaluation.sessionMedianReactionTimeMs)}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Hits / misses</p>
                  <p className="stat-value">
                    {sessionResult.session.clicks.length} / {sessionResult.session.misses}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Your baseline (median)</p>
                  <p className="stat-value">
                    {formatMs(sessionResult.baselines.driver.medianReactionTimeMs)}
                  </p>
                  <p className="muted tiny">
                    {sessionResult.baselines.driver.sessionCount} sessions ·{' '}
                    {sessionResult.baselines.driver.clickCount} clicks
                  </p>
                </div>
                <div>
                  <p className="stat-label">Company baseline (median)</p>
                  <p className="stat-value">
                    {formatMs(sessionResult.baselines.company.medianReactionTimeMs)}
                  </p>
                  <p className="muted tiny">
                    {sessionResult.baselines.company.sessionCount} sessions ·{' '}
                    {sessionResult.baselines.company.clickCount} clicks
                  </p>
                </div>
              </div>

              {sessionResult.evaluation.shouldAlert ? (
                <div className="alert-banner" role="alert">
                  <strong>Fatigue concern flagged</strong>
                  <ul>
                    {sessionResult.evaluation.alertReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {sessionResult.evaluation.alertPhoneConfigured ? (
                    <p className="muted tiny">Supervisor alert has been sent.</p>
                  ) : (
                    <p className="muted tiny">
                      Alert placeholder logged on server — set ALERT_PHONE_NUMBER to enable SMS/call.
                    </p>
                  )}
                </div>
              ) : (
                <p className="success">Reaction times look within expected range for your baselines.</p>
              )}

              <details className="click-log">
                <summary>Per-click reaction times</summary>
                <ol>
                  {sessionResult.session.clicks.map((c, i) => (
                    <li key={i}>
                      #{i + 1}: {formatMs(c.reactionTimeMs)} (target {c.targetSizePx}px)
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : null}
          <button type="button" onClick={handlePlayAgain} disabled={loading}>
            Run again
          </button>
        </main>
      )}
    </div>
  );
}
