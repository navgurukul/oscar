//! Suppresses WebView2's default microphone-permission popup on Windows.
//!
//! Tauri 2 serves the frontend over `https://tauri.localhost` on Windows.
//! When the renderer calls `navigator.mediaDevices.getUserMedia`, WebView2's
//! built-in permission UI shows the page origin — "tauri.localhost wants to
//! use your microphone" — which users perceive as a request from "tauri",
//! not OSCAR. The in-app onboarding screen already gates microphone access,
//! so we pre-grant the permission at the WebView2 layer and suppress the
//! Edge popup entirely.

use tauri::{Runtime, WebviewWindow};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2PermissionRequestedEventArgs,
    COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
    COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
};
use webview2_com::PermissionRequestedEventHandler;

pub fn install<R: Runtime>(window: &WebviewWindow<R>) {
    let label = window.label().to_string();
    let label_for_log = label.clone();

    if let Err(e) = window.with_webview(move |webview| unsafe {
        let controller = webview.controller();
        let core: ICoreWebView2 = match controller.CoreWebView2() {
            Ok(c) => c,
            Err(e) => {
                log::warn!(
                    "[mic-perm] CoreWebView2 unavailable for {label}: {e:?}"
                );
                return;
            }
        };

        let handler = PermissionRequestedEventHandler::create(Box::new(
            |_sender: Option<ICoreWebView2>,
             args: Option<ICoreWebView2PermissionRequestedEventArgs>| {
                if let Some(args) = args {
                    let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                    args.PermissionKind(&mut kind)?;
                    if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                        || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                    {
                        args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                    }
                }
                Ok(())
            },
        ));

        let mut token: i64 = 0;
        if let Err(e) = core.add_PermissionRequested(&handler, &mut token) {
            log::warn!(
                "[mic-perm] add_PermissionRequested failed for {label}: {e:?}"
            );
        } else {
            log::info!("[mic-perm] WebView2 mic auto-grant installed for {label}");
        }
    }) {
        log::warn!(
            "[mic-perm] with_webview failed for {label_for_log}: {e:?}"
        );
    }
}
