import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Proc = { name: string; pm_id: number; pid: number; monit?: { memory?: number; cpu?: number }; pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number } }

export default function App() {
  const [list, setList] = useState<Proc[]>([])
  const [logs, setLogs] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  async function refresh() {
    const data = await invoke<Proc[]>('pm2_list')
    setList(data)
    setUpdatedAt(new Date())
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

  async function getLogs(name: string) {
    const txt = await invoke<string>('pm2_logs', { name, lines: 80 })
    setLogs(txt)
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
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
          <button className="secondary" style={{ marginLeft: 8 }} onClick={refresh}>Refresh</button>
        </div>
      </div>
      <small>Last updated: {updatedAt?.toLocaleTimeString() ?? '—'}</small>

      <div className="grid" style={{ marginTop: 12 }}>
        {list.map((p) => (
          <div key={p.pm_id} className="card">
            <div className="row">
              <div>
                <strong>{p.name}</strong> <small>#{p.pm_id}</small>
                <div><small>Status: {p.pm2_env?.status ?? 'unknown'} · CPU {Math.round(p.monit?.cpu ?? 0)}% · MEM {Math.round((p.monit?.memory ?? 0)/1024/1024)}MB</small></div>
              </div>
              <div className="actions">
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
    </div>
  )
}
