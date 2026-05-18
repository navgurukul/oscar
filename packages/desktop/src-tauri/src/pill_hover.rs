//! macOS cursor-hover poller for the dictation pill.
//!
//! Why this exists: the pill window is a non-activating NSPanel so it never
//! becomes the key window. WebKit installs its own tracking areas with the
//! default `NSTrackingActiveInActiveApp` activation, so CSS :hover and
//! `mouseenter` only fire when Oscar itself is the foreground app. The whole
//! point of the dictation pill is hovering it while the user is in another
//! app — exactly the case where DOM hover stays silent.
//!
//! The fix: a small polling thread reads the global cursor position via
//! Tauri's `app.cursor_position()` (CoreGraphics under the hood, works
//! regardless of focus). When the cursor enters/leaves the bottom-edge hot
//! zone we hop to the main thread and drive the pill phase directly.

use std::time::{Duration, Instant};

use tauri::AppHandle;

const POLL_INTERVAL: Duration = Duration::from_millis(45);
const LEAVE_DEBOUNCE: Duration = Duration::from_millis(220);
const HOT_ZONE_WIDTH_LOGICAL: f64 = 360.0;
const HOT_ZONE_HEIGHT_LOGICAL: f64 = 90.0;

pub(crate) fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_in_zone = false;
        let mut leave_started: Option<Instant> = None;

        loop {
            std::thread::sleep(POLL_INTERVAL);

            let Ok(cursor) = app.cursor_position() else { continue };
            let Ok(Some(monitor)) = app.primary_monitor() else { continue };

            let m_pos = monitor.position();
            let m_size = monitor.size();
            let scale = monitor.scale_factor();

            let m_bottom_phys = m_pos.y as f64 + m_size.height as f64;
            let m_center_x_phys = m_pos.x as f64 + m_size.width as f64 / 2.0;

            let zone_h_phys = HOT_ZONE_HEIGHT_LOGICAL * scale;
            let zone_w_phys = HOT_ZONE_WIDTH_LOGICAL * scale;

            let zone_top = m_bottom_phys - zone_h_phys;
            let zone_left = m_center_x_phys - zone_w_phys / 2.0;
            let zone_right = m_center_x_phys + zone_w_phys / 2.0;

            let in_zone = cursor.x >= zone_left
                && cursor.x <= zone_right
                && cursor.y >= zone_top
                && cursor.y <= m_bottom_phys;

            let phase = crate::pill::current_pill_phase();
            let can_auto_transition = matches!(phase, "rest" | "ready" | "expanded");

            if in_zone {
                leave_started = None;
                if !last_in_zone && can_auto_transition && phase != "expanded" {
                    crate::pill::apply_phase_from_rust(&app, "expanded");
                }
                last_in_zone = true;
            } else if last_in_zone {
                if leave_started.is_none() {
                    leave_started = Some(Instant::now());
                }
                if let Some(t) = leave_started {
                    if t.elapsed() >= LEAVE_DEBOUNCE {
                        if can_auto_transition && phase == "expanded" {
                            crate::pill::apply_phase_from_rust(&app, "rest");
                        }
                        last_in_zone = false;
                        leave_started = None;
                    }
                }
            }
        }
    });
}
