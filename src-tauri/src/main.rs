// Windowsのリリース版で余分なコンソールを表示しない。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    traceprism_desktop::run();
}
