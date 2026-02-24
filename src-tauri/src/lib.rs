use std::process::Command;

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
fn pm2_logs(name: String, lines: u32) -> Result<String, String> {
  let out = Command::new("pm2")
    .args(["logs", name.as_str(), "--lines", &lines.to_string(), "--nostream"])
    .output()
    .map_err(|e| e.to_string())?;

  let s = format!(
    "{}\n{}",
    String::from_utf8_lossy(&out.stdout),
    String::from_utf8_lossy(&out.stderr)
  );
  Ok(s)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![pm2_list, pm2_action, pm2_logs])
    .run(tauri::generate_context!())
    .expect("error while running pm2-control");
}
