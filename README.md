# PM2 Control

Lightweight macOS desktop dashboard for PM2.

## MVP

- View PM2 process list (`pm2 jlist`)
- Start / Stop / Restart process
- View recent logs
- Auto-refresh every 5s

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
