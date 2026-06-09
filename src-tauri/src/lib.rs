use std::sync::Mutex;
use std::process::Child;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter, Manager, Window};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Serialize, Deserialize)]
pub struct SetupStatus {
    pub phase: String, // "installing", "starting", "ready", "error"
    pub detail: String,
}

pub struct AppState {
    pub status: Mutex<SetupStatus>,
    pub child_process: Mutex<Option<Child>>,
}

#[tauri::command]
fn get_setup_status(state: tauri::State<'_, AppState>) -> SetupStatus {
    state.status.lock().unwrap().clone()
}

#[tauri::command]
fn get_api_base() -> String {
    "http://127.0.0.1:8765".to_string()
}

#[tauri::command]
fn minimize_window(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn maximize_window(window: Window) {
    if let Ok(is_maximized) = window.is_maximized() {
        if is_maximized {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn close_window(window: Window) {
    // Hide window instead of closing to run in background / system tray
    let _ = window.hide();
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

fn run_setup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Resolve current working directory
        let cwd = match std::env::current_dir() {
            Ok(dir) => dir,
            Err(e) => {
                update_status(&app, "error", &format!("Failed to get current directory: {}", e));
                return;
            }
        };
        
        let mut backend_dir = cwd.join("backend");
        if !backend_dir.exists() {
            if let Some(parent) = cwd.parent() {
                let parent_backend = parent.join("backend");
                if parent_backend.exists() {
                    backend_dir = parent_backend;
                }
            }
        }
        
        let venv_dir = backend_dir.join(".venv");
        let req_file = backend_dir.join("requirements.txt");
        
        // Ensure backend directory exists
        if !backend_dir.exists() {
            update_status(&app, "error", &format!("Backend directory not found at {:?}", backend_dir));
            return;
        }

        // Verify requirements file exists
        if !req_file.exists() {
            update_status(&app, "error", &format!("requirements.txt not found at {:?}", req_file));
            return;
        }

        // Create virtualenv if it doesn't exist
        if !venv_dir.exists() {
            update_status(&app, "installing", "Creating python virtual environment (first launch)...");
            
            #[cfg(windows)]
            let status = tokio::process::Command::new("cmd")
                .args(&["/C", "python -m venv .venv"])
                .current_dir(&backend_dir)
                .status()
                .await;
                
            #[cfg(not(windows))]
            let status = tokio::process::Command::new("python3")
                .args(&["-m", "venv", ".venv"])
                .current_dir(&backend_dir)
                .status()
                .await;
                
            match status {
                Ok(s) if s.success() => {
                    update_status(&app, "installing", "Installing dependencies via pip (may take 1-2 mins)...");
                }
                _ => {
                    update_status(&app, "error", "Failed to create python virtual environment. Make sure python/python3 is in your PATH.");
                    return;
                }
            }
            
            // Pip install requirements
            let pip_path = if cfg!(windows) {
                venv_dir.join("Scripts").join("pip.exe")
            } else {
                venv_dir.join("bin").join("pip")
            };
            
            let status = tokio::process::Command::new(&pip_path)
                .args(&["install", "-r", "requirements.txt"])
                .current_dir(&backend_dir)
                .status()
                .await;
                
            match status {
                Ok(s) if s.success() => {
                    update_status(&app, "starting", "Dependencies installed successfully. Starting server...");
                }
                _ => {
                    update_status(&app, "error", "Failed to install dependencies via pip. Check internet connection and try again.");
                    return;
                }
            }
        } else {
            update_status(&app, "starting", "Starting backend server...");
        }
        
        // Resolve python executable path
        let python_bin = if cfg!(windows) {
            venv_dir.join("Scripts").join("python.exe")
        } else {
            venv_dir.join("bin").join("python")
        };
        
        if !python_bin.exists() {
            update_status(&app, "error", &format!("Python executable not found at {:?}", python_bin));
            return;
        }
        
        // Spawn uvicorn process
        let mut cmd = std::process::Command::new(&python_bin);
        cmd.args(&["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8765"]);
        cmd.current_dir(&backend_dir);
        
        // Hide window console on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        
        match cmd.spawn() {
            Ok(child) => {
                let state = app.state::<AppState>();
                *state.child_process.lock().unwrap() = Some(child);
            }
            Err(e) => {
                update_status(&app, "error", &format!("Failed to start backend server: {}", e));
                return;
            }
        }
        
        // Poll backend health endpoint
        let client = reqwest::Client::new();
        let mut retries = 0;
        let max_retries = 40; // 20 seconds
        
        loop {
            if retries >= max_retries {
                update_status(&app, "error", "Backend server failed to start or respond in a timely manner.");
                return;
            }
            
            match client.get("http://127.0.0.1:8765/health").send().await {
                Ok(resp) if resp.status().is_success() => {
                    update_status(&app, "ready", "Jarvis is ready!");
                    break;
                }
                _ => {
                    retries += 1;
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    });
}

fn update_status(app: &AppHandle, phase: &str, detail: &str) {
    let state = app.state::<AppState>();
    let mut status = state.status.lock().unwrap();
    status.phase = phase.to_string();
    status.detail = detail.to_string();
    let _ = app.emit("setup:progress", status.clone());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            status: Mutex::new(SetupStatus {
                phase: "starting".to_string(),
                detail: "Initializing...".to_string(),
            }),
            child_process: Mutex::new(None),
        })
        .setup(|app| {
            // System tray setup
            let show = MenuItemBuilder::with_id("show", "Show / Hide").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Jarvis").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Jarvis")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Register Ctrl+J to toggle window visibility
            let ctrl_j = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyJ);
            if let Err(e) = app.global_shortcut().on_shortcut(ctrl_j, |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }) {
                eprintln!("Warning: failed to register Ctrl+J global shortcut: {}", e);
            }

            // Run backend setup
            run_setup(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_setup_status,
            get_api_base,
            minimize_window,
            maximize_window,
            close_window,
            exit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            // Clean up the Python backend server child process
            let state = app_handle.state::<AppState>();
            let child = state.child_process.lock().unwrap().take();
            if let Some(mut child) = child {
                let _ = child.kill();
            }
        }
    });
}
