mod runs;

#[tauri::command]
async fn list_runs(selected_id: Option<String>) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || runs::list_runs(selected_id.as_deref()))
        .await
        .map_err(|error| error.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![list_runs])
        .run(tauri::generate_context!())
        .expect("TracePrism の起動に失敗しました");
}
