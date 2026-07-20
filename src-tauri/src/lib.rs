use std::sync::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{UpdaterExt, Update};
use windows::Win32::System::DataExchange::{
    OpenClipboard, EmptyClipboard, SetClipboardData, CloseClipboard,
};
use windows::Win32::Foundation::{HWND, HANDLE};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use base64::Engine;

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

struct MinimizedFlag(bool);


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
    let (update, _) = pending.0.lock().unwrap().take()
        .ok_or("没有待下载的更新".to_string())?;
    let version = update.version.clone();

    let urls = [
        format!("https://gitee.com/Henry_Yves/timelog/releases/download/v{0}/timelog_{0}_x64_en-US.msi", version),
        format!("https://github.com/HenryYves/Timelog/releases/download/v{0}/timelog_{0}_x64_en-US.msi", version),
    ];

    let mut last_err = String::new();
    let client = reqwest::Client::new();

    for url in &urls {
        match client.get(url).timeout(std::time::Duration::from_secs(300)).send().await {
            Ok(resp) if resp.status().is_success() => {
                let total = resp.content_length();
                let _ = on_event.send(DownloadEvent::Started { content_length: total });

                let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
                let _ = on_event.send(DownloadEvent::Progress { chunk_length: bytes.len() });
                let _ = on_event.send(DownloadEvent::Finished);

                *pending.0.lock().unwrap() = Some((update, bytes));
                return Ok(());
            }
            Ok(resp) => {
                last_err = format!("HTTP {}", resp.status().as_u16());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    // All URLs failed — put update back so user can retry
    *pending.0.lock().unwrap() = Some((update, Vec::new()));
    Err(format!("下载失败：{}", last_err))
}

fn open_clipboard(app: &AppHandle) -> Result<HWND, String> {
    let win = app.get_webview_window("main").ok_or("window not found")?;
    let hwnd = HWND(win.hwnd().map_err(|e| format!("hwnd: {}", e))?.0 as *mut _);
    unsafe { OpenClipboard(hwnd).map_err(|e| format!("OpenClipboard: {:?}", e))?; }
    Ok(hwnd)
}

#[tauri::command]
fn clipboard_write_image(app: AppHandle, width: u32, height: u32, rgba_base64: String) -> Result<(), String> {
    let rgba = base64::engine::general_purpose::STANDARD.decode(&rgba_base64).map_err(|e| format!("base64: {}", e))?;
    let w = width as i32; let h = height as i32;
    let row = ((w * 32 + 31) / 32) * 4;
    let header = 40usize;
    let total = header + (row * h) as usize;
    let mut dib = vec![0u8; total];
    dib[0..4].copy_from_slice(&40u32.to_le_bytes());
    dib[4..8].copy_from_slice(&w.to_le_bytes());
    dib[8..12].copy_from_slice(&(-h).to_le_bytes());
    dib[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib[14..16].copy_from_slice(&32u16.to_le_bytes());
    for y in 0..h {
        let src_r = (y as usize) * (w as usize) * 4;
        let dst_r = (y as usize) * (row as usize);
        for x in 0..w as usize {
            let s = src_r + x * 4; let d = dst_r + x * 4;
            dib[header + d] = rgba[s + 2];
            dib[header + d + 1] = rgba[s + 1];
            dib[header + d + 2] = rgba[s];
            dib[header + d + 3] = rgba[s + 3];
        }
    }
    unsafe {
        open_clipboard(&app)?;
        let _ = EmptyClipboard();
        let h = GlobalAlloc(GMEM_MOVEABLE, total).map_err(|e| format!("GlobalAlloc: {:?}", e))?;
        let p = GlobalLock(h);
        std::ptr::copy_nonoverlapping(dib.as_ptr(), p as *mut u8, total);
        let _ = GlobalUnlock(h);
        SetClipboardData(8, HANDLE(h.0)).map_err(|e| format!("SetClipboardData: {:?}", e))?; // CF_DIB
        CloseClipboard().map_err(|e| format!("CloseClipboard: {:?}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = wide.len() * 2;
    unsafe {
        open_clipboard(&app)?;
        let _ = EmptyClipboard();
        let h = GlobalAlloc(GMEM_MOVEABLE, bytes).map_err(|e| format!("GlobalAlloc: {:?}", e))?;
        let p = GlobalLock(h);
        std::ptr::copy_nonoverlapping(wide.as_ptr(), p as *mut u16, wide.len());
        let _ = GlobalUnlock(h);
        SetClipboardData(13, HANDLE(h.0)).map_err(|e| format!("SetClipboardData(text): {:?}", e))?; // CF_UNICODETEXT
        CloseClipboard().map_err(|e| format!("CloseClipboard: {:?}", e))?;
    }
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
pub fn run(reset_settings: bool, minimized: bool) {
    let reset = reset_settings;

    tauri::Builder::default()
        .manage(MinimizedFlag(minimized))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            app.manage(PendingUpdate(Mutex::new(None)));

            // CLI --reset-settings: clear localStorage before page loads
            if reset {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval(
                        "for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(!k||!k.startsWith('timelog:'))continue;const n=k.slice(8);if(/^\\d{4}-\\d{2}-\\d{2}$/.test(n)||n==='tags'||n.startsWith('stats-')||n==='rolloutCache'||n==='skipVersion'||n==='pendingDownload')continue;localStorage.removeItem(k)}"
                    );
                }
            }

            // Handle exit-time install
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                let min = app.state::<MinimizedFlag>().0;
                if min {
                    let _ = window.minimize();
                } else {
                    // Show window after state restoration to avoid flash
                    let _ = window.show();
                }
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
            clipboard_write_image,
            clipboard_write_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
