use std::process::Command;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

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

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let restart_all = MenuItem::with_id(app, "restart_all", "Restart All", true, None::<&str>)?;
    let start_all = MenuItem::with_id(app, "start_all", "Start All", true, None::<&str>)?;
    let stop_all = MenuItem::with_id(app, "stop_all", "Stop All", true, None::<&str>)?;
    let save = MenuItem::with_id(app, "save", "Save PM2 State", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[&open, &sep, &start_all, &restart_all, &stop_all, &save, &sep, &quit],
    )?;

    let icon = app.default_window_icon().cloned();
    let mut tray_builder = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(true);
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

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            build_tray(app.handle())?;

            let handle = app.handle().clone();
            app.on_menu_event(move |app, event| match event.id().as_ref() {
                "open" => show_main_window(app),
                "start_all" => {
                    let _ = pm2_action_all("start".into());
                    show_main_window(&handle);
                }
                "restart_all" => {
                    let _ = pm2_action_all("restart".into());
                    show_main_window(&handle);
                }
                "stop_all" => {
                    let _ = pm2_action_all("stop".into());
                    show_main_window(&handle);
                }
                "save" => {
                    let _ = pm2_save();
                    show_main_window(&handle);
                }
                "quit" => app.exit(0),
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pm2_list,
            pm2_action,
            pm2_action_all,
            pm2_save,
            pm2_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running pm2-control");
}
