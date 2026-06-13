//! Cross-platform cursor-hover poller for the dictation pill (macOS + Windows).
//!
//! Why this exists:
//! - macOS: the pill is a non-activating NSPanel so it never becomes the key
//!   window. WebKit installs its own tracking areas with the default
//!   `NSTrackingActiveInActiveApp` activation, so CSS :hover and `mouseenter`
//!   only fire when Oscar itself is the foreground app. The whole point of
//!   the dictation pill is hovering it while the user is in another app —
//!   exactly the case where DOM hover stays silent.
//! - Windows: the pill is an always-on-top non-activating window only 16 px
//!   tall at rest. WebView2 dispatches WM_MOUSEMOVE while another app holds
//!   focus, but the thin rest strip and instant resize on expand make the
//!   DOM-only path racy (mouseenter/mouseleave can fire on the wrong frame
//!   during a resize). Driving phase off the OS cursor position gives the
//!   same reliable behavior macOS gets.
//!
//! The fix: a small polling thread reads the global cursor position via
//! Tauri's `app.cursor_position()` (CoreGraphics on macOS, `GetCursorPos` on
//! Windows — works regardless of focus). When the cursor enters/leaves the
//! bottom-edge hot zone we hop to the main thread and drive the pill phase
//! directly.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};


/// Must be stopped before the pill window is torn down (e.g. before an updater
/// install): the poller touches the pill window every `POLL_INTERVAL`, and
/// destroying the window while a poll is in flight deadlocks the app. Stop the
/// poller, wait one poll cycle, then tear down.
static POLLER_GEN: AtomicU64 = AtomicU64::new(0);

pub(crate) fn stop() {
    POLLER_GEN.fetch_add(1, Ordering::SeqCst);
}

const POLL_INTERVAL: Duration = Duration::from_millis(45);
const LEAVE_DEBOUNCE: Duration = Duration::from_millis(220);
/// Trigger zone — cursor must reach the narrow bottom-edge strip around the
/// visible handle (~96 px) to expand. Matches the rest NSPanel footprint so
/// the expand zone exactly tracks the area that can't pass clicks anyway.
const TRIGGER_WIDTH_LOGICAL: f64 = 140.0;
const TRIGGER_HEIGHT_LOGICAL: f64 = 16.0;
/// Keep-expanded zone — once expanded, the pill stays open while the cursor
/// is anywhere over the full expanded pill body (360 wide). Width and height
/// both expand so the user can sweep across the whole pill / settings popover
/// without triggering a collapse.
const KEEP_WIDTH_LOGICAL: f64 = 360.0;
const KEEP_HEIGHT_LOGICAL: f64 = 80.0;

pub(crate) fn start(app: AppHandle) {
   let generation = POLLER_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        let mut last_in_zone = false;
        let mut leave_started: Option<Instant> = None;

        loop {
            std::thread::sleep(POLL_INTERVAL);

            if POLLER_GEN.load(Ordering::SeqCst) != generation {
                return;
            }

            let Ok(cursor) = app.cursor_position() else { continue };
            let Ok(Some(monitor)) = app.primary_monitor() else { continue };

            let m_pos = monitor.position();
            let m_size = monitor.size();
            let scale = monitor.scale_factor();

            let m_bottom_phys = m_pos.y as f64 + m_size.height as f64;
            let m_center_x_phys = m_pos.x as f64 + m_size.width as f64 / 2.0;

            // Hysteresis: small trigger zone before expand, larger keep-open
            // zone once expanded — avoids both an over-sensitive bottom edge
            // and a too-eager collapse when cursor moves up to the pill body.
            //
            // When the pill window is taller than the default expanded height
            // (e.g. settings popover open at 380 px), grow the keep-zone to
            // match the actual window height so the cursor can reach the
            // popover items without triggering a collapse.
            let (zone_w_logical, zone_h_logical) = if last_in_zone {
                let win_h_logical = app
                    .get_webview_window("recording-pill")
                    .and_then(|w| w.inner_size().ok())
                    .map(|s| s.height as f64 / scale)
                    .unwrap_or(KEEP_HEIGHT_LOGICAL);
                (KEEP_WIDTH_LOGICAL, win_h_logical.max(KEEP_HEIGHT_LOGICAL))
            } else {
                (TRIGGER_WIDTH_LOGICAL, TRIGGER_HEIGHT_LOGICAL)
            };
            let zone_h_phys = zone_h_logical * scale;
            let zone_w_phys = zone_w_logical * scale;

            let zone_top = m_bottom_phys - zone_h_phys;
            let zone_left = m_center_x_phys - zone_w_phys / 2.0;
            let zone_right = m_center_x_phys + zone_w_phys / 2.0;

            let in_zone = cursor.x >= zone_left
                && cursor.x <= zone_right
                && cursor.y >= zone_top
                && cursor.y <= m_bottom_phys;

            // The stored phase tracks the "real" pill state (rest, recording,
            // processing, inserted, error). `store_pill_phase` deliberately
            // skips the transient hover states ("ready", "expanded",
            // "settings"), so we cannot use the stored phase to detect whether
            // the pill is currently expanded — that's what `last_in_zone`
            // tracks instead. We only auto-transition when the underlying
            // state is "rest"; anything else (recording/processing/etc.) is a
            // user-driven flow we must not disturb.
            let stored_phase = crate::pill::current_pill_phase();
            let is_resting = stored_phase == "rest";

            if in_zone {
                leave_started = None;
                // Only expand when Stream is enabled (authenticated + set up).
                // Bookkeeping below still runs so a login mid-hover expands on
                // the next zone entry.
                if !last_in_zone && is_resting && crate::pill::pill_enabled() {
                    crate::pill::apply_phase_from_rust(&app, "expanded");
                }
                last_in_zone = true;
            } else if last_in_zone {
                if leave_started.is_none() {
                    leave_started = Some(Instant::now());
                }
                if let Some(t) = leave_started {
                    if t.elapsed() >= LEAVE_DEBOUNCE {
                        if is_resting {
                            // Re-apply "rest" to shrink the window back down.
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
