# PM2 Control

Lightweight macOS desktop dashboard for PM2.

## MVP (Phase 2)

- View PM2 process list (`pm2 jlist`)
- Start / Stop / Restart per process
- Start all / Stop all / Restart all
- Save PM2 process state (`pm2 save`)
- View recent logs
- Auto-refresh every 5s
- Menu bar (tray) icon with quick actions + Open Dashboard
- Tray title shows live running/total count (e.g. `3/5`)
- One-click tray shortcuts to restart top services

## Why

Use PM2 as the CLI source of truth, with a quick visual dashboard so you can see service status at a glance.

## Run

```bash
cd ~/git/pm2-control
npm install
npm run tauri:dev
```

## Notes

- Requires `pm2` to be installed and available in PATH.
- Current scaffold includes Tauri commands for list/action/logs.
- Next step: add tray/menu bar status + quick actions.
