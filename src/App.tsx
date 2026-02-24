import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Proc = { name: string; pm_id: number; pid: number; monit?: { memory?: number; cpu?: number }; pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number } }
type FilterMode = 'all' | 'online' | 'non-online'
type MetricHistory = Record<string, { cpu: number[]; mem: number[] }>

function serviceUrl(name: string, tailscale: boolean): string | null {
  const base = 'https://brets-macbook-pro-m2-max.tailb491d6.ts.net'
  if (name === 'golfgit-dev') return tailscale ? `${base}:8443/` : 'http://127.0.0.1:3000'
  if (name === 'codex-switcher-web') return tailscale ? `${base}:8444/` : 'http://127.0.0.1:5176'
  if (name === 'codex-switcher-api') return tailscale ? `${base}/codex-api` : 'http://127.0.0.1:8788/api/health'
  if (name === 'ps4-mission-control') return tailscale ? `${base}:8445/` : 'http://127.0.0.1:8787/mission-control/'
  return null
}

function statusClass(status?: string) {
  if (status === 'online') return 'pill ok'
  if (status === 'stopped') return 'pill warn'
  return 'pill err'
}

function Sparkline({ values, color = '#8fb3ff' }: { values: number[]; color?: string }) {
  const width = 90
  const height = 24
  if (values.length < 2) return <svg width={width} height={height} className="sparkline" />

  const max = Math.max(...values, 1)
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1
      const y = height - (v / max) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="sparkline" role="img" aria-label="trend sparkline">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  )
}

export default function App() {
  const [list, setList] = useState<Proc[]>([])
  const [history, setHistory] = useState<MetricHistory>({})
  const [logs, setLogs] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [useTailscale, setUseTailscale] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [compactMode, setCompactMode] = useState(false)
  const [logService, setLogService] = useState<string | null>(null)

  async function refresh() {
    const started = Date.now()
    setIsRefreshing(true)
    try {
      const data = await invoke<Proc[]>('pm2_list')
      setList(data)
      setHistory((prev) => {
        const next: MetricHistory = { ...prev }
        for (const p of data) {
          const cpu = Math.round(p.monit?.cpu ?? 0)
          const mem = Math.round((p.monit?.memory ?? 0) / 1024 / 1024)
          const cur = next[p.name] ?? { cpu: [], mem: [] }
          next[p.name] = {
            cpu: [...cur.cpu, cpu].slice(-20),
            mem: [...cur.mem, mem].slice(-20),
          }
        }
        return next
      })
      setUpdatedAt(new Date())
    } finally {
      const elapsed = Date.now() - started
      const minVisibleMs = 350
      const wait = Math.max(0, minVisibleMs - elapsed)
      setTimeout(() => setIsRefreshing(false), wait)
    }
  }

  async function action(name: string, cmd: 'start' | 'stop' | 'restart') {
    await invoke('pm2_action', { name, action: cmd })
    await refresh()
  }

  async function actionAll(cmd: 'start' | 'stop' | 'restart') {
    await invoke('pm2_action_all', { action: cmd })
    await refresh()
  }

  async function saveState() {
    await invoke('pm2_save')
    await refresh()
  }

  async function restartMissionControl() {
    await invoke('restart_mission_control')
  }

  async function openService(name: string) {
    await invoke('open_service', { name, tailscale: useTailscale })
  }

  async function getLogs(name: string) {
    const txt = await invoke<string>('pm2_logs', { name, lines: 120 })
    setLogs(txt)
    setLogService(name)
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCmdR = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r'
      if (!isCmdR) return
      e.preventDefault()
      refresh()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const running = list.filter((p) => p.pm2_env?.status === 'online').length
  const issues = list.filter((p) => p.pm2_env?.status !== 'online')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((p) => {
      const status = p.pm2_env?.status ?? 'unknown'
      const filterPass =
        filter === 'all' ? true : filter === 'online' ? status === 'online' : status !== 'online'
      const queryPass = q.length === 0 ? true : p.name.toLowerCase().includes(q)
      return filterPass && queryPass
    })
  }, [list, query, filter])

  return (
    <div className={`container ${compactMode ? 'compact' : ''}`}>
      <div className="header">
        <div>
          <h1>PM2 Control</h1>
          <small className="subtitle">Command Center</small>
        </div>
        <div className="top-actions">
          <span className="badge">Running {running}/{list.length}</span>
          <button className="secondary" onClick={() => actionAll('start')}>Start all</button>
          <button className="secondary" onClick={() => actionAll('restart')}>Restart all</button>
          <button className="warn" onClick={() => actionAll('stop')}>Stop all</button>
          <button className="secondary" onClick={saveState}>Save</button>
          <button className="secondary" onClick={restartMissionControl}>Restart Mission</button>
          <button className="secondary" style={{ minWidth: 92 }} onClick={refresh}>
            <span className={isRefreshing ? 'spin' : ''}>↻</span> <span style={{ marginLeft: 6 }}>Refresh</span>
          </button>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="alert-rail">
          <strong>{issues.length} service{issues.length > 1 ? 's' : ''} need attention:</strong>{' '}
          {issues.map((i) => i.name).join(', ')}
        </div>
      ) : null}

      <div className="subbar">
        <small>Last updated: {updatedAt?.toLocaleTimeString() ?? '—'}</small>

        <div className="filters">
          <input
            className="search"
            placeholder="Filter services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={filter === 'all' ? '' : 'secondary'} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'online' ? '' : 'secondary'} onClick={() => setFilter('online')}>Online</button>
          <button className={filter === 'non-online' ? '' : 'secondary'} onClick={() => setFilter('non-online')}>Issues</button>
          <button className={compactMode ? '' : 'secondary'} onClick={() => setCompactMode(v => !v)}>
            {compactMode ? 'Comfort' : 'Compact'}
          </button>
        </div>

        <label className="toggle" role="switch" aria-checked={useTailscale}>
          <input
            type="checkbox"
            checked={useTailscale}
            onChange={(e) => setUseTailscale(e.target.checked)}
            aria-label="Toggle Tailscale links"
          />
          <span className="track" aria-hidden="true">
            <span className="thumb" />
          </span>
          <small>Tailscale links</small>
        </label>
      </div>

      <div className="main-layout">
        <div className="grid" style={{ marginTop: 12 }}>
          {filtered.map((p) => {
            const status = p.pm2_env?.status ?? 'unknown'
            const mem = Math.round((p.monit?.memory ?? 0) / 1024 / 1024)
            const cpu = Math.round(p.monit?.cpu ?? 0)
            const restarts = p.pm2_env?.restart_time ?? 0
            const metrics = history[p.name] ?? { cpu: [], mem: [] }

            return (
              <div key={p.pm_id} className="card">
                <div className="row">
                  <div>
                    <div className="title-row">
                      <strong>{p.name}</strong>
                      <span className={statusClass(status)}>{status}</span>
                      <span className="restart-chip">restarts {restarts}</span>
                    </div>
                    <div>
                      <small>CPU {cpu}% · MEM {mem}MB · PID {p.pid || '—'}</small>
                    </div>
                    <div className="spark-row">
                      <small>CPU</small>
                      <Sparkline values={metrics.cpu} color="#8fb3ff" />
                      <small>MEM</small>
                      <Sparkline values={metrics.mem} color="#87f0cb" />
                    </div>
                    {serviceUrl(p.name, useTailscale) ? (
                      <div><small>URL: {serviceUrl(p.name, useTailscale)}</small></div>
                    ) : null}
                  </div>
                  <div className="actions">
                    <button onClick={() => openService(p.name)}>Open</button>
                    <button onClick={() => action(p.name, 'start')}>Start</button>
                    <button className="secondary" onClick={() => action(p.name, 'restart')}>Restart</button>
                    <button className="warn" onClick={() => action(p.name, 'stop')}>Stop</button>
                    <button className="secondary" onClick={() => getLogs(p.name)}>Logs</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <aside className="logs-panel">
          <div className="logs-head">
            <h3>Live Logs</h3>
            {logService ? <small>{logService}</small> : <small>No service selected</small>}
          </div>
          {logs ? <pre>{logs}</pre> : <div className="empty">Pick a service and click Logs</div>}
        </aside>
      </div>

      <div style={{ marginTop: 16, opacity: 0.75 }}>
        <small>Version v{__APP_VERSION__} · Commit {__APP_COMMIT__}</small>
      </div>
    </div>
  )
}
