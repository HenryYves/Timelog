// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let reset_settings = args.iter().any(|a| a == "--reset-settings");
    let minimized = args.iter().any(|a| a == "--minimized" || a == "--min");
    timelog_lib::run(reset_settings, minimized)
}
