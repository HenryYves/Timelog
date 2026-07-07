use std::sync::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{UpdaterExt, Update};

// ── Types ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    version: String,
    current_version: String,
    body: Option<String>,
    date: Option<String>,
    /// Gray rollout percentage 0-100, None = 100% (no gating)
    rollout: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started { content_length: Option<u64> },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Finished,
}

// ── State ──

/// Holds an optional downloaded update paired with its raw bytes.
/// - After `check_update`: bytes is `Vec::new()` (not yet downloaded).
/// - After `download_update`: bytes contains the full binary.
struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

// ── Commands ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestJson {
    version: Option<String>,
    rollout: Option<u8>,
}

#[tauri::command]
async fn fetch_latest_json() -> Result<Option<LatestJson>, String> {
    let endpoints = [
        "https://gitee.com/Henry_Yves/timelog/raw/main/latest.json",
        "https://raw.githubusercontent.com/HenryYves/Timelog/main/latest.json",
    ];
    let client = reqwest::Client::new();
    for url in endpoints {
        match client.get(url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(r) if r.status().is_success() => {
                if let Ok(json) = r.json::<serde_json::Value>().await {
                    return Ok(Some(LatestJson {
                        version: json.get("version").and_then(|v| v.as_str()).map(String::from),
                        rollout: json.get("rollout").and_then(|v| v.as_u64()).map(|n| n as u8),
                    }));
                }
                return Ok(None);
            }
            _ => continue,
        }
    }
    Ok(None)
}

#[tauri::command]
async fn check_update(
    app: AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
) -> Result<Option<UpdateMetadata>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    let metadata = update.as_ref().map(|u| UpdateMetadata {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        body: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
        rollout: None,
    });

    // Store update paired with an empty byte buffer (will be filled by download_update)
    *pending.0.lock().unwrap() = update.map(|u| (u, Vec::new()));
    Ok(metadata)
}

#[tauri::command]
async fn download_update(
    pending: tauri::State<'_, PendingUpdate>,
    on_event: tauri::ipc::Channel<DownloadEvent>,
) -> Result<(), String> {
    // Extract the update and drop the lock before the async download
    let update = pending.0.lock().unwrap().take()
        .ok_or("没有待下载的更新".to_string())?
        .0; // discard the empty bytes vec

    let started = std::sync::Mutex::new(false);
    let finished_channel = on_event.clone();

    let bytes = update
        .download(
            move |chunk_length, content_length| {
                let mut started = started.lock().unwrap();
                if !*started {
                    let _ = on_event.send(DownloadEvent::Started { content_length });
                    *started = true;
                }
                let _ = on_event.send(DownloadEvent::Progress { chunk_length });
            },
            move || {
                let _ = finished_channel.send(DownloadEvent::Finished);
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    // Put update back with downloaded bytes for the install step
    *pending.0.lock().unwrap() = Some((update, bytes));
    Ok(())
}

#[tauri::command]
async fn install_update(
    pending: tauri::State<'_, PendingUpdate>,
    app: AppHandle,
) -> Result<(), String> {
    let (update, bytes) = pending.0.lock().unwrap().take()
        .ok_or("没有待安装的更新".to_string())?;

    if bytes.is_empty() {
        return Err("更新尚未下载".to_string());
    }

    update.install(&bytes).map_err(|e| e.to_string())?;
    app.restart()
}

// ── App Entry ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(PendingUpdate(Mutex::new(None)));

            // Handle exit-time install
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                // Show window after state restoration to avoid flash
                let _ = window.show();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let pending = handle.state::<PendingUpdate>();
                        let mut lock = pending.0.lock().unwrap();
                        if let Some((update, bytes)) = lock.take() {
                            if !bytes.is_empty() {
                                api.prevent_close();
                                drop(lock);
                                let handle = handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = update.install(&bytes);
                                    handle.restart();
                                });
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_latest_json,
            check_update,
            download_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
