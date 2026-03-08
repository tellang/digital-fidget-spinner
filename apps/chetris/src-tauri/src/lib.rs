use tauri::{
    Emitter, Manager,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    LogicalPosition, PhysicalPosition, PhysicalSize,
};
use rdev::{listen, EventType};
use serde_json::Value;
use std::{
    fs, path::PathBuf, thread,
    sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}},
};
use tauri_plugin_updater::UpdaterExt;

/// 설정 파일 경로 (exe 옆에 저장)
fn settings_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    exe.parent().unwrap_or(&exe).join("chatris-settings.json")
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        let handle = app.clone();
        let mut downloaded = 0usize;
        update.download_and_install(
            move |chunk_len, total| {
                downloaded += chunk_len;
                let _ = handle.emit("update-progress", serde_json::json!({
                    "downloaded": downloaded,
                    "total": total,
                }));
            },
            || {},
        ).await.map_err(|e| e.to_string())?;
        let _ = app.emit("update-installed", ());
    }
    Ok(())
}

#[tauri::command]
fn position_window_cmd(app: tauri::AppHandle, position: String) {
    if let Some(win) = app.get_webview_window("main") {
        position_window(&win, &position);
    }
}

#[tauri::command]
fn load_settings() -> String {
    fs::read_to_string(settings_path()).unwrap_or_default()
}

#[tauri::command]
fn save_settings(json: String) {
    let _ = fs::write(settings_path(), json);
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle, x: i32, y: i32) {
    if let Some(win) = app.get_webview_window("settings") {
        // 설정 윈도우 크기 (논리 픽셀)
        let (sw, sh) = (300_i32, 520_i32);

        // 화면 크기 (논리 픽셀로 변환)
        let (vw, vh) = app.get_webview_window("main")
            .and_then(|w| w.current_monitor().ok().flatten())
            .map(|m| {
                let s = m.scale_factor();
                ((m.size().width as f64 / s) as i32, (m.size().height as f64 / s) as i32)
            })
            .unwrap_or((1920, 1080));

        // 스마트 포지셔닝: 공간이 부족한 방향은 반대로 플립
        let adj_x = if x + sw > vw { x - sw } else { x };
        let adj_y = if y + sh > vh { y - sh } else { y };

        let pos = LogicalPosition::new(adj_x.max(0), adj_y.max(0));
        let _ = win.set_position(pos.clone());
        let _ = win.show();
        let _ = win.set_position(pos);
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn set_auto_start(enable: bool) {
    // Windows 시작 프로그램 등록 (레지스트리)
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = std::env::current_exe().unwrap_or_default();
        let exe_str = exe.to_string_lossy();
        if enable {
            let _ = Command::new("reg")
                .args(["add", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                       "/v", "CHATRIS", "/t", "REG_SZ", "/d", &exe_str, "/f"])
                .output();
        } else {
            let _ = Command::new("reg")
                .args(["delete", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                       "/v", "CHATRIS", "/f"])
                .output();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            exit_app, load_settings, save_settings, set_auto_start, position_window_cmd, install_update, open_settings_window
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // 초기 위치: 화면 우하단
            position_window(&window, "br");
            let _ = window.set_focus();
            let _ = window.set_min_size(Some(PhysicalSize::new(120_u32, 195_u32)));

            // 비율 유지 리사이즈 (164:252) — 상하/좌우/모서리 모두 지원
            let resize_guard = Arc::new(AtomicBool::new(false));
            let last_width = Arc::new(Mutex::new(
                window.outer_size().map(|s| s.width).unwrap_or(174),
            ));
            let rg = resize_guard.clone();
            let lw = last_width.clone();
            let win_for_resize = window.clone();
            let win_for_close = window.clone();
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::Resized(size) => {
                        if rg.load(Ordering::SeqCst) { return; }
                        let aspect: f64 = 164.0 / 252.0;
                        let mut prev_w = lw.lock().unwrap();
                        let (new_w, new_h) = if size.width != *prev_w {
                            (size.width, (size.width as f64 / aspect).round() as u32)
                        } else {
                            ((size.height as f64 * aspect).round() as u32, size.height)
                        };
                        *prev_w = new_w;
                        if new_w != size.width || new_h != size.height {
                            rg.store(true, Ordering::SeqCst);
                            let _ = win_for_resize.set_size(PhysicalSize::new(new_w, new_h));
                            rg.store(false, Ordering::SeqCst);
                        }
                    }
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        // 트레이 최소화 설정 시 닫기 대신 숨김
                        let minimize = fs::read_to_string(settings_path())
                            .ok()
                            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                            .and_then(|v| v.get("minimizeToTray").and_then(|b| b.as_bool()))
                            .unwrap_or(true);
                        if minimize {
                            api.prevent_close();
                            let _ = win_for_close.hide();
                        }
                    }
                    _ => {}
                }
            });

            // 글로벌 키보드 훅 (채널 분리 — IME 간섭 방지)
            // 훅 콜백은 channel send만 (나노초), emit은 별도 스레드에서 처리
            let (tx, rx) = std::sync::mpsc::channel::<()>();
            let emit_handle = app.handle().clone();
            thread::spawn(move || {
                while rx.recv().is_ok() {
                    let _ = emit_handle.emit("global-keypress", ());
                }
            });
            // 글로벌 키보드 훅 스레드 (자동 재등록 + 프론트엔드 상태 알림)
            let hook_handle = app.handle().clone();
            thread::spawn(move || {
                let mut fail_count: u32 = 0;
                loop {
                    let tx_clone = tx.clone();
                    let _ = hook_handle.emit("hook-status", "active");
                    match listen(move |event| {
                        if let EventType::KeyPress(_) = event.event_type {
                            let _ = tx_clone.send(());
                        }
                    }) {
                        Ok(_) => { fail_count = 0; }
                        Err(_) => { fail_count += 1; }
                    }
                    let _ = hook_handle.emit("hook-status", "reconnecting");
                    // 빠른 재등록: 50ms → 100ms → 200ms → 최대 1초
                    let delay = std::cmp::min(50 * 2_u64.pow(fail_count.min(4)), 1000);
                    thread::sleep(std::time::Duration::from_millis(delay));
                }
            });

            // === 트레이 아이콘 (좌클릭: 토글, 우클릭: 설정 윈도우) ===
            let icon = app.default_window_icon().unwrap().clone();

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("CHATRIS - 채팅 반응형 테트리스")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, position, .. } = &event {
                        if *button_state != MouseButtonState::Up { return; }
                        let app = tray.app_handle();
                        match button {
                            MouseButton::Left => {
                                if let Some(win) = app.get_webview_window("main") {
                                    if win.is_visible().unwrap_or(false) {
                                        let _ = win.hide();
                                    } else {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                            }
                            MouseButton::Right => {
                                if let Some(win) = app.get_webview_window("settings") {
                                    let size = win.outer_size().unwrap_or(PhysicalSize::new(300, 520));
                                    let _ = win.set_position(PhysicalPosition::new(
                                        (position.x as i32 - size.width as i32).max(0),
                                        (position.y as i32 - size.height as i32).max(0),
                                    ));
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            // 자동 업데이트 체크 (시작 5초 후, 설정 확인 후 프론트엔드에 알림)
            let update_handle = app.handle().clone();
            thread::spawn(move || {
                thread::sleep(std::time::Duration::from_secs(5));
                let auto_update = fs::read_to_string(settings_path())
                    .ok()
                    .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                    .and_then(|v| v.get("autoUpdate").and_then(|b| b.as_bool()))
                    .unwrap_or(true);
                if !auto_update { return; }
                tauri::async_runtime::block_on(async move {
                    let Ok(updater) = update_handle.updater() else { return };
                    let Ok(Some(update)) = updater.check().await else { return };
                    let ver = update.version.clone();
                    let _ = update_handle.emit("update-available", serde_json::json!({
                        "version": ver,
                    }));
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("CHATRIS 실행 중 에러 발생");
}

/// 윈도우를 지정된 모서리로 이동
fn position_window(window: &tauri::WebviewWindow, position: &str) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let screen = monitor.size();
        let pos = monitor.position();
        let margin = 12;
        let taskbar_h = 50;
        let win_size = window.outer_size().unwrap_or(PhysicalSize::new(174, 288));
        let win_w = win_size.width as i32;
        let win_h = win_size.height as i32;

        let (x, y) = match position {
            "tl" => (pos.x + margin, pos.y + margin),
            "tr" => (pos.x + screen.width as i32 - win_w - margin, pos.y + margin),
            "bl" => (pos.x + margin, pos.y + screen.height as i32 - win_h - taskbar_h),
            _ => (
                pos.x + screen.width as i32 - win_w - margin,
                pos.y + screen.height as i32 - win_h - taskbar_h,
            ),
        };

        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}
