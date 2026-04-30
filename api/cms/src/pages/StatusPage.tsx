import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, getLogs, StatusCheck, StatusResponse, LogEntry } from '../lib/api'

interface Props {
  token: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  DELETE: 'method-delete',
  PATCH: 'method-patch',
}

function statusColor(code: number | null): string {
  if (code === null) return 'status-down'
  if (code < 300) return 'status-ok'
  if (code === 301 || code === 302) return 'status-redirect'
  if (code === 401 || code === 403) return 'status-protected'
  if (code < 500) return 'status-warn'
  return 'status-down'
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function StatusPage({ token }: Props) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [s, l] = await Promise.all([getStatus(), getLogs(token, 100)])
      setStatus(s)
      setLogs(l)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, 15_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh])

  const operational = status?.operational ?? 0
  const total = status?.total ?? 0
  const pct = total ? Math.round((operational / total) * 100) : 0
  const allGood = status && status.down === 0

  return (
    <div className="view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="view-hdr">
        <h2>API Status</h2>
        <div className="status-hdr-right">
          {lastRefresh && (
            <span className="muted">Refreshed {lastRefresh.toLocaleTimeString([], { hour12: false })}</span>
          )}
          <button className="ghost btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && <div className="err-msg">{error}</div>}

      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      {status && (
        <div className={`status-summary ${allGood ? 'summary-ok' : 'summary-warn'}`}>
          <span className={`status-dot ${allGood ? 'dot-green' : 'dot-red'}`} />
          <strong>{allGood ? 'All systems operational' : `${status.down} endpoint${status.down !== 1 ? 's' : ''} degraded`}</strong>
          <span className="muted">&nbsp;—&nbsp;{operational} / {total} operational ({pct}%)</span>
        </div>
      )}

      {/* ── Endpoint cards ──────────────────────────────────────────────── */}
      {status && (
        <div className="status-grid">
          {status.checks.map((c: StatusCheck, i: number) => (
            <div key={i} className={`status-card ${c.operational ? '' : 'card-down'}`}>
              <div className="status-card-top">
                <span className={`method-badge ${METHOD_COLORS[c.method] ?? ''}`}>{c.method}</span>
                <span className="status-url mono">{c.url}</span>
              </div>
              <div className="status-card-label">{c.label}</div>
              <div className="status-card-bottom">
                {c.statusCode !== null ? (
                  <span className={`http-code ${statusColor(c.statusCode)}`}>{c.statusCode}</span>
                ) : (
                  <span className="http-code status-down">ERR</span>
                )}
                {c.protected && <span className="sc-badge badge-protected">protected</span>}
                {c.operational && !c.protected && <span className="sc-badge badge-ok">OK</span>}
                {!c.operational && <span className="sc-badge badge-down">down</span>}
                {c.timeMs !== null && (
                  <span className="status-time muted">{c.timeMs}ms</span>
                )}
              </div>
              {c.error && <div className="status-card-error muted">{c.error}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Request Log ──────────────────────────────────────────────────── */}
      <div className="view-hdr" style={{ marginTop: 32 }}>
        <h2>Request Log <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>last {logs.length}</span></h2>
      </div>

      {logs.length === 0 ? (
        <p className="empty">No requests logged yet.</p>
      ) : (
        <div className="log-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry: LogEntry, i: number) => (
                <tr key={i}>
                  <td className="mono muted">{formatTs(entry.timestamp)}</td>
                  <td>
                    <span className={`method-badge ${METHOD_COLORS[entry.method] ?? ''}`}>{entry.method}</span>
                  </td>
                  <td className="mono log-url">{entry.url}</td>
                  <td>
                    <span className={`http-code ${statusColor(entry.statusCode)}`}>{entry.statusCode}</span>
                  </td>
                  <td className="mono muted" style={{ textAlign: 'right' }}>{entry.responseTimeMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
