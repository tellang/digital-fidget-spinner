use tauri::{
    Emitter, Manager,
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    tray::TrayIconBuilder,
    PhysicalPosition, PhysicalSize,
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
        let _ = win.set_position(PhysicalPosition::new(x, y));
        let _ = win.show();
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
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Resized(size) = event {
                    // 재귀 방지 (set_size → Resized 이벤트 재발 차단)
                    if rg.load(Ordering::SeqCst) { return; }

                    let aspect: f64 = 164.0 / 252.0;
                    let mut prev_w = lw.lock().unwrap();

                    let (new_w, new_h) = if size.width != *prev_w {
                        // 너비 변경 (좌/우/모서리 드래그) → 높이 조정
                        (size.width, (size.width as f64 / aspect).round() as u32)
                    } else {
                        // 높이만 변경 (상/하 드래그) → 너비 조정
                        ((size.height as f64 * aspect).round() as u32, size.height)
                    };

                    *prev_w = new_w;

                    if new_w != size.width || new_h != size.height {
                        rg.store(true, Ordering::SeqCst);
                        let _ = win_for_resize.set_size(PhysicalSize::new(new_w, new_h));
                        rg.store(false, Ordering::SeqCst);
                    }
                }
            });

            // 글로벌 키보드 훅 (실패 시 자동 재시도 — 모니터 전환 등 대응)
            let app_handle = app.handle().clone();
            thread::spawn(move || {
                loop {
                    let handle = app_handle.clone();
                    let result = listen(move |event| {
                        if let EventType::KeyPress(_key) = event.event_type {
                            let _ = handle.emit("global-keypress", ());
                        }
                    });
                    if result.is_ok() { break; }
                    // 리스너 실패 시 1초 후 재시도
                    thread::sleep(std::time::Duration::from_secs(1));
                }
            });

            // === 트레이 메뉴 ===

            // 위치 서브메뉴
            let pos_tl = MenuItem::with_id(app, "pos_tl", "↖ 좌상단", true, None::<&str>)?;
            let pos_tr = MenuItem::with_id(app, "pos_tr", "↗ 우상단", true, None::<&str>)?;
            let pos_bl = MenuItem::with_id(app, "pos_bl", "↙ 좌하단", true, None::<&str>)?;
            let pos_br = MenuItem::with_id(app, "pos_br", "↘ 우하단", true, None::<&str>)?;
            let pos_submenu = SubmenuBuilder::new(app, "위치 변경")
                .items(&[&pos_tl, &pos_tr, &pos_bl, &pos_br])
                .build()?;

            // 테마 서브메뉴
            let theme_cyberpunk = MenuItem::with_id(app, "theme_cyberpunk", "🌃 Cyberpunk Neon", true, None::<&str>)?;
            let theme_gameboy = MenuItem::with_id(app, "theme_gameboy", "🎮 Game Boy", true, None::<&str>)?;
            let theme_pastel = MenuItem::with_id(app, "theme_pastel", "🌸 Pastel Dream", true, None::<&str>)?;
            let theme_matrix = MenuItem::with_id(app, "theme_matrix", "💊 Matrix", true, None::<&str>)?;
            let theme_glass = MenuItem::with_id(app, "theme_glass", "🪟 Glassmorphism", true, None::<&str>)?;
            let theme_retro = MenuItem::with_id(app, "theme_retro", "👾 Retro Arcade", true, None::<&str>)?;
            let theme_submenu = SubmenuBuilder::new(app, "테마")
                .items(&[&theme_cyberpunk, &theme_gameboy, &theme_pastel, &theme_matrix, &theme_glass, &theme_retro])
                .build()?;

            // 설정 서브메뉴
            let toggle_particles = MenuItem::with_id(app, "toggle_particles", "✨ 파티클 효과", true, None::<&str>)?;
            let toggle_shake = MenuItem::with_id(app, "toggle_shake", "📳 진동 효과", true, None::<&str>)?;
            let toggle_fade = MenuItem::with_id(app, "toggle_autoFade", "👻 자동 페이드", true, None::<&str>)?;
            let toggle_autostart = MenuItem::with_id(app, "toggle_autoStart", "🚀 윈도우 시작 등록", true, None::<&str>)?;
            let settings_submenu = SubmenuBuilder::new(app, "설정")
                .items(&[&toggle_particles, &toggle_shake, &toggle_fade, &toggle_autostart])
                .build()?;

            let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&pos_submenu, &theme_submenu, &settings_submenu, &quit_item])
                .build()?;

            let icon = app.default_window_icon().unwrap().clone();

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("CHATRIS - 채팅 반응형 테트리스")
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    let id = event.id().0.as_str();
                    match id {
                        "quit" => app.exit(0),
                        _ if id.starts_with("pos_") => {
                            if let Some(win) = app.get_webview_window("main") {
                                position_window(&win, &id[4..]);
                            }
                        }
                        _ if id.starts_with("theme_") => {
                            let theme_id = &id[6..];
                            let _ = app.emit("set-theme", theme_id.to_string());
                        }
                        _ if id.starts_with("toggle_") => {
                            let key = &id[7..];
                            // 설정 파일에서 현재 값 읽고 반전
                            let current = fs::read_to_string(settings_path())
                                .ok()
                                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                                .and_then(|v| v.get(key).and_then(|b| b.as_bool()))
                                .unwrap_or(true);
                            let new_val = !current;

                            // 자동 시작은 별도 처리
                            if key == "autoStart" {
                                let _ = tauri::async_runtime::spawn(async move {
                                    // set_auto_start은 동기지만 async 블록에서 호출
                                });
                                #[cfg(target_os = "windows")]
                                {
                                    use std::process::Command;
                                    let exe = std::env::current_exe().unwrap_or_default();
                                    let exe_str = exe.to_string_lossy().to_string();
                                    if new_val {
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

                            let payload = serde_json::json!({ "key": key, "value": new_val });
                            let _ = app.emit("toggle-setting", payload);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // 자동 업데이트 체크 (시작 5초 후, 프론트엔드에 알림)
            let update_handle = app.handle().clone();
            thread::spawn(move || {
                thread::sleep(std::time::Duration::from_secs(5));
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
