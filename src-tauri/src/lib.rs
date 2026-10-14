mod runs;

use tauri_plugin_fs::FsExt;

#[tauri::command]
async fn list_runs(selected_id: Option<String>) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || runs::list_runs(selected_id.as_deref()))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn watch_runs_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = traceprism::run_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    app.fs_scope()
        .allow_directory(&dir, false)
        .map_err(|error| error.to_string())?;
    dir.into_os_string()
        .into_string()
        .map_err(|_| "run directory is not valid UTF-8".to_owned())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![list_runs, watch_runs_dir])
        .run(tauri::generate_context!())
        .expect("TracePrism の起動に失敗しました");
}
