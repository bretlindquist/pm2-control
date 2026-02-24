use std::process::Command;

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

#[derive(Debug, Clone, Deserialize)]
struct Pm2Env {
    status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Pm2Proc {
    name: String,
    pm2_env: Option<Pm2Env>,
}

fn pm2_list_raw() -> Result<Vec<Pm2Proc>, String> {
    let out = Command::new("pm2")
        .args(["jlist"])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }

    serde_json::from_slice::<Vec<Pm2Proc>>(&out.stdout).map_err(|e| e.to_string())
}

#[tauri::command]
fn pm2_list() -> Result<serde_json::Value, String> {
    let out = Command::new("pm2")
        .args(["jlist"])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    serde_json::from_slice::<serde_json::Value>(&out.stdout).map_err(|e| e.to_string())
}

#[tauri::command]
fn pm2_action(name: String, action: String) -> Result<(), String> {
    let allowed = ["start", "stop", "restart"];
    if !allowed.contains(&action.as_str()) {
        return Err("invalid action".into());
    }

    let out = Command::new("pm2")
        .args([action.as_str(), name.as_str()])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn pm2_action_all(action: String) -> Result<(), String> {
    let allowed = ["start", "stop", "restart"];
    if !allowed.contains(&action.as_str()) {
        return Err("invalid action".into());
    }

    let out = Command::new("pm2")
        .args([action.as_str(), "all"])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn pm2_save() -> Result<(), String> {
    let out = Command::new("pm2")
        .args(["save"])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn pm2_logs(name: String, lines: u32) -> Result<String, String> {
    let out = Command::new("pm2")
        .args(["logs", name.as_str(), "--lines", &lines.to_string(), "--nostream"])
        .output()
        .map_err(|e| e.to_string())?;

    Ok(format!(
        "{}\n{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    ))
}

#[tauri::command]
fn restart_mission_control() -> Result<(), String> {
    let out = Command::new("sh")
        .args([
            "-lc",
            "pkill -f 'mission-control/server.py' || true; nohup python3 ~/git/PS4/mission-control/server.py >/tmp/mission-control.log 2>&1 &",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn open_service(name: String) -> Result<(), String> {
    let url = match name.as_str() {
        "golfgit-dev" => "http://127.0.0.1:3000",
        "codex-switcher-web" => "http://127.0.0.1:5176",
        "ps4-mission-control" => "http://127.0.0.1:8787/mission-control/",
        _ => return Err(format!("No open URL configured for {name}")),
    };

    let out = Command::new("open")
        .arg(url)
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn refresh_tray_title(app: &AppHandle) {
    if let Ok(list) = pm2_list_raw() {
        let total = list.len();
        let running = list
            .iter()
            .filter(|p| p.pm2_env.as_ref().and_then(|e| e.status.as_deref()) == Some("online"))
            .count();
        if let Some(tray) = app.tray_by_id("main-tray") {
            let _ = tray.set_title(Some(&format!("{running}/{total}")));
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let mut names = pm2_list_raw()
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.name)
        .collect::<Vec<_>>();
    names.sort();

    let s0 = names.first().cloned();
    let s1 = names.get(1).cloned();
    let s2 = names.get(2).cloned();

    let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let refresh_tray = MenuItem::with_id(app, "refresh_tray", "Refresh Tray", true, None::<&str>)?;
    let restart_all = MenuItem::with_id(app, "restart_all", "Restart All", true, None::<&str>)?;
    let start_all = MenuItem::with_id(app, "start_all", "Start All", true, None::<&str>)?;
    let stop_all = MenuItem::with_id(app, "stop_all", "Stop All", true, None::<&str>)?;
    let save = MenuItem::with_id(app, "save", "Save PM2 State", true, None::<&str>)?;
    let restart_mission = MenuItem::with_id(app, "restart_mission", "Restart Mission Control", true, None::<&str>)?;

    let svc0 = MenuItem::with_id(
        app,
        s0.as_ref().map(|n| format!("svc_restart:{n}")).unwrap_or_else(|| "svc_none:0".into()),
        s0.as_ref().map(|n| format!("Restart {n}")).unwrap_or_else(|| "No service".into()),
        s0.is_some(),
        None::<&str>,
    )?;
    let svc1 = MenuItem::with_id(
        app,
        s1.as_ref().map(|n| format!("svc_restart:{n}")).unwrap_or_else(|| "svc_none:1".into()),
        s1.as_ref().map(|n| format!("Restart {n}")).unwrap_or_else(|| "No service".into()),
        s1.is_some(),
        None::<&str>,
    )?;
    let svc2 = MenuItem::with_id(
        app,
        s2.as_ref().map(|n| format!("svc_restart:{n}")).unwrap_or_else(|| "svc_none:2".into()),
        s2.as_ref().map(|n| format!("Restart {n}")).unwrap_or_else(|| "No service".into()),
        s2.is_some(),
        None::<&str>,
    )?;

    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &open,
            &refresh_tray,
            &sep,
            &start_all,
            &restart_all,
            &stop_all,
            &save,
            &restart_mission,
            &sep,
            &svc0,
            &svc1,
            &svc2,
            &sep,
            &quit,
        ],
    )?;

    let icon = app.default_window_icon().cloned();
    let mut tray_builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .title("0/0")
        .show_menu_on_left_click(true);
    if let Some(i) = icon {
        tray_builder = tray_builder.icon(i);
    }

    let _ = tray_builder
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    refresh_tray_title(app);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            build_tray(app.handle())?;

            let handle = app.handle().clone();
            app.on_menu_event(move |app, event| {
                let id = event.id().as_ref().to_string();
                match id.as_str() {
                    "open" => show_main_window(app),
                    "refresh_tray" => refresh_tray_title(app),
                    "start_all" => {
                        let _ = pm2_action_all("start".into());
                        refresh_tray_title(app);
                        show_main_window(&handle);
                    }
                    "restart_all" => {
                        let _ = pm2_action_all("restart".into());
                        refresh_tray_title(app);
                        show_main_window(&handle);
                    }
                    "stop_all" => {
                        let _ = pm2_action_all("stop".into());
                        refresh_tray_title(app);
                        show_main_window(&handle);
                    }
                    "save" => {
                        let _ = pm2_save();
                        show_main_window(&handle);
                    }
                    "restart_mission" => {
                        let _ = restart_mission_control();
                        show_main_window(&handle);
                    }
                    "quit" => app.exit(0),
                    _ if id.starts_with("svc_restart:") => {
                        let name = id.trim_start_matches("svc_restart:").to_string();
                        let _ = pm2_action(name, "restart".into());
                        refresh_tray_title(app);
                        show_main_window(&handle);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pm2_list,
            pm2_action,
            pm2_action_all,
            pm2_save,
            pm2_logs,
            restart_mission_control,
            open_service
        ])
        .run(tauri::generate_context!())
        .expect("error while running pm2-control");
}
