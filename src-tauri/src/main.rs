// Verpackt die bestehende KieselWesen-Web-UI (index.html/app.js/main.js) als
// native Desktop-App. Keine eigene Logik hier — die Simulation und die
// Oberfläche bleiben unverändert im Browser-Code; Tauri liefert nur das
// Fenster und die lokale Installation.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten von KieselWesen");
}
