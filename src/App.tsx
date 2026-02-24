import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Proc = { name: string; pm_id: number; pid: number; monit?: { memory?: number; cpu?: number }; pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number } }

function serviceUrl(name: string, tailscale: boolean): string | null {
  const base = 'https://brets-macbook-pro-m2-max.tailb491d6.ts.net'
  if (name === 'golfgit-dev') return tailscale ? `${base}/golf` : 'http://127.0.0.1:3000'
  if (name === 'codex-switcher-web') return tailscale ? `${base}/codex` : 'http://127.0.0.1:5176'
  if (name === 'codex-switcher-api') return tailscale ? `${base}/codex-api` : 'http://127.0.0.1:8788/api/health'
  if (name === 'ps4-mission-control') return tailscale ? `${base}/ps4` : 'http://127.0.0.1:8787/mission-control/'
  return null
}

export default function App() {
  const [list, setList] = useState<Proc[]>([])
  const [logs, setLogs] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [useTailscale, setUseTailscale] = useState(false)

  async function refresh() {
    const started = Date.now()
    setIsRefreshing(true)
    try {
      const data = await invoke<Proc[]>('pm2_list')
      setList(data)
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
    try {
      await invoke('open_service', { name, tailscale: useTailscale })
    } catch (e) {
      console.error(e)
    }
  }

  async function getLogs(name: string) {
    const txt = await invoke<string>('pm2_logs', { name, lines: 80 })
    setLogs(txt)
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

  return (
    <div className="container">
      <div className="header">
        <h1>PM2 Control</h1>
        <div>
          <span className="badge">Running {running}/{list.length}</span>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={() => actionAll('start')}>Start all</button>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={() => actionAll('restart')}>Restart all</button>
          <button className="warn" style={{ marginLeft: 8 }} onClick={() => actionAll('stop')}>Stop all</button>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={saveState}>Save</button>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={restartMissionControl}>Restart Mission</button>
          <button className="secondary" style={{ marginLeft: 8, minWidth: 92 }} onClick={refresh}>
            <span className={isRefreshing ? 'spin' : ''}>↻</span> <span style={{ marginLeft: 6 }}>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <small>Last updated: {updatedAt?.toLocaleTimeString() ?? '—'}</small>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useTailscale}
            onChange={(e) => setUseTailscale(e.target.checked)}
          />
          <small>Tailscale links</small>
        </label>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {list.map((p) => (
          <div key={p.pm_id} className="card">
            <div className="row">
              <div>
                <strong>{p.name}</strong> <small>#{p.pm_id}</small>
                <div>
                  <small>Status: {p.pm2_env?.status ?? 'unknown'} · CPU {Math.round(p.monit?.cpu ?? 0)}% · MEM {Math.round((p.monit?.memory ?? 0)/1024/1024)}MB</small>
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
        ))}
      </div>

      {logs ? (
        <div style={{ marginTop: 14 }}>
          <h3>Recent logs</h3>
          <pre>{logs}</pre>
        </div>
      ) : null}

      <div style={{ marginTop: 16, opacity: 0.75 }}>
        <small>Version v{__APP_VERSION__} · Commit {__APP_COMMIT__}</small>
      </div>
    </div>
  )
}
