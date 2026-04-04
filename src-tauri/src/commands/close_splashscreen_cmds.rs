use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn close_splashscreen(app_handle: AppHandle) {
    println!("close_splashscreen");
    let splash_window = app_handle.get_webview_window("splashscreen").unwrap();
    let main_window = app_handle.get_webview_window("main").unwrap();
    splash_window.close().unwrap();
    main_window.show().unwrap();
    main_window.set_focus().unwrap();
}
