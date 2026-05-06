//! macOS-only Objective-C bridge: accessibility/screen-capture permissions,
//! NSWindow → NSPanel conversion for fullscreen-overlay pill, app activation
//! via NSRunningApplication, and Cmd+V CGEvent posting.
//!
//! Extracted from `lib.rs` — behavior unchanged.

#![cfg(target_os = "macos")]

use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use std::ffi::c_void;

extern "C" {
    fn objc_getClass(name: *const std::ffi::c_char) -> *mut c_void;
    fn sel_registerName(name: *const std::ffi::c_char) -> *mut c_void;
    fn objc_msgSend() -> *mut c_void;
    fn object_setClass(obj: *mut c_void, cls: *mut c_void) -> *mut c_void;
}

// Accessibility check
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFDictionaryCreate(
        allocator: *const c_void,
        keys: *mut *const c_void,
        values: *mut *const c_void,
        num_values: isize,
        key_callbacks: *const c_void,
        value_callbacks: *const c_void,
    ) -> *mut c_void;
    fn CFStringCreateWithCString(
        alloc: *const c_void,
        c_str: *const std::ffi::c_char,
        encoding: u32,
    ) -> *mut c_void;
    fn CFRelease(cf: *mut c_void);
    static kCFBooleanTrue: *const c_void;
    static kCFBooleanFalse: *const c_void;
    static kCFTypeDictionaryKeyCallBacks: c_void;
    static kCFTypeDictionaryValueCallBacks: c_void;
}

// kCFStringEncodingUTF8
const CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

pub fn is_accessibility_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

/// Re-register the current binary with TCC **without** showing a system
/// dialog (kAXTrustedCheckOptionPrompt = false).  This is called when
/// AXIsProcessTrusted() returns false after a rebuild so that the new
/// binary hash is written to the TCC database.  Returns true if the
/// process is now trusted (e.g., the user had it toggled on for a
/// previous build).
pub fn reregister_without_prompt() -> bool {
    unsafe {
        let key = CFStringCreateWithCString(
            std::ptr::null(),
            b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const _,
            CF_STRING_ENCODING_UTF8,
        );
        // kCFBooleanFalse — re-register the binary hash, no dialog shown
        let value = kCFBooleanFalse;
        let mut keys_arr: *const c_void = key as *const c_void;
        let mut vals_arr: *const c_void = value;
        let dict = CFDictionaryCreate(
            std::ptr::null(),
            &mut keys_arr as *mut _,
            &mut vals_arr as *mut _,
            1,
            &kCFTypeDictionaryKeyCallBacks as *const c_void,
            &kCFTypeDictionaryValueCallBacks as *const c_void,
        );
        let trusted = AXIsProcessTrustedWithOptions(dict);
        CFRelease(dict);
        CFRelease(key as *mut c_void);
        trusted
    }
}

/// Request accessibility permission with a system prompt.
/// Uses AXIsProcessTrustedWithOptions which registers the current binary
/// with macOS and opens System Settings if not already trusted.
pub fn request_accessibility_with_prompt() -> bool {
    unsafe {
        let key = CFStringCreateWithCString(
            std::ptr::null(),
            b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const _,
            CF_STRING_ENCODING_UTF8,
        );
        let value = kCFBooleanTrue;
        let mut keys_arr: *const c_void = key as *const c_void;
        let mut vals_arr: *const c_void = value;
        let dict = CFDictionaryCreate(
            std::ptr::null(),
            &mut keys_arr as *mut _,
            &mut vals_arr as *mut _,
            1,
            &kCFTypeDictionaryKeyCallBacks as *const c_void,
            &kCFTypeDictionaryValueCallBacks as *const c_void,
        );
        let trusted = AXIsProcessTrustedWithOptions(dict);
        CFRelease(dict);
        CFRelease(key as *mut c_void);
        trusted
    }
}

pub fn is_screen_capture_trusted() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

pub fn request_screen_capture_with_prompt() -> bool {
    unsafe { CGRequestScreenCaptureAccess() }
}

/// Convert an NSWindow to NSPanel and configure it to float above fullscreen apps.
/// NSPanel is the only window type macOS allows to appear over fullscreen Spaces.
/// MUST be called on the main thread — NSWindow/NSPanel methods are main-thread-only.
pub fn set_window_above_fullscreen(ns_window_ptr: *mut c_void) {
    unsafe {
        // 0. Convert NSWindow → NSPanel via isa-swizzle.
        //    NSPanel is a subclass of NSWindow with identical memory layout,
        //    so changing the class pointer is safe. This is what tauri-nspanel does.
        let ns_panel_class = objc_getClass(b"NSPanel\0".as_ptr() as *const _);
        if !ns_panel_class.is_null() {
            object_setClass(ns_window_ptr, ns_panel_class);
            log::info!("[pill] converted NSWindow → NSPanel via isa-swizzle");
        } else {
            log::warn!("[pill] could not find NSPanel class!");
        }

        // 1. Set window level to kCGScreenSaverWindowLevel (1000)
        //    This is above fullscreen app windows (~level 8-14)
        let sel_set_level = sel_registerName(b"setLevel:\0".as_ptr() as *const _);
        type SetLevelFn = unsafe extern "C" fn(*mut c_void, *mut c_void, i64);
        let set_level: SetLevelFn = std::mem::transmute(objc_msgSend as *const ());
        set_level(ns_window_ptr, sel_set_level, 1000);

        // 2. Set collection behavior flags for fullscreen Space compatibility
        let sel_set_behavior =
            sel_registerName(b"setCollectionBehavior:\0".as_ptr() as *const _);
        type SetBehaviorFn = unsafe extern "C" fn(*mut c_void, *mut c_void, u64);
        let set_behavior: SetBehaviorFn = std::mem::transmute(objc_msgSend as *const ());
        // NSWindowCollectionBehaviorCanJoinAllSpaces          = 1 << 0 = 1
        // NSWindowCollectionBehaviorStationary                = 1 << 4 = 16
        // NSWindowCollectionBehaviorIgnoresCycle              = 1 << 6 = 64
        // NSWindowCollectionBehaviorFullScreenAuxiliary       = 1 << 8 = 256
        set_behavior(ns_window_ptr, sel_set_behavior, 1 | 16 | 64 | 256);

        // 3. Set NSPanel-specific properties:
        //    - setFloatingPanel: YES — stays above other windows
        //    - setWorksWhenModal: YES — works even during modal dialogs
        //    - setHidesOnDeactivate: NO — don't hide when app loses focus
        let sel_set_floating =
            sel_registerName(b"setFloatingPanel:\0".as_ptr() as *const _);
        let sel_set_works_modal =
            sel_registerName(b"setWorksWhenModal:\0".as_ptr() as *const _);
        let sel_set_hides =
            sel_registerName(b"setHidesOnDeactivate:\0".as_ptr() as *const _);
        type SetBoolFn = unsafe extern "C" fn(*mut c_void, *mut c_void, bool);
        let set_bool: SetBoolFn = std::mem::transmute(objc_msgSend as *const ());
        set_bool(ns_window_ptr, sel_set_floating, true);
        set_bool(ns_window_ptr, sel_set_works_modal, true);
        set_bool(ns_window_ptr, sel_set_hides, false);

        // 4. Add NSNonactivatingPanel style (bit 7 = 128) so showing the
        //    panel doesn't activate the app or steal focus from fullscreen apps.
        let sel_style = sel_registerName(b"styleMask\0".as_ptr() as *const _);
        type GetStyleFn = unsafe extern "C" fn(*mut c_void, *mut c_void) -> u64;
        let get_style: GetStyleFn = std::mem::transmute(objc_msgSend as *const ());
        let current_style = get_style(ns_window_ptr, sel_style);

        let sel_set_style = sel_registerName(b"setStyleMask:\0".as_ptr() as *const _);
        type SetStyleFn = unsafe extern "C" fn(*mut c_void, *mut c_void, u64);
        let set_style: SetStyleFn = std::mem::transmute(objc_msgSend as *const ());
        // NSWindowStyleMaskNonactivatingPanel = 1 << 7 = 128
        set_style(ns_window_ptr, sel_set_style, current_style | 128);

        log::info!(
            "[pill] NSPanel configured: level=1000, floating=YES, hidesOnDeactivate=NO, \
             behavior=canJoinAll|stationary|ignoresCycle|fullScreenAux, style |= NonactivatingPanel"
        );
    }
}

/// Activate a running macOS app by its display name using NSRunningApplication.
/// Unlike `open -a`, this does NOT trigger a Space-switch animation, so it is
/// safe to use with fullscreen apps.  Returns Ok(true) if the app was found and
/// activated, Ok(false) if the app was not in the running-applications list.
pub fn activate_app(app_name: &str) -> Result<bool, String> {
    unsafe {
        // NSWorkspace.sharedWorkspace.runningApplications
        let ws_class = objc_getClass(b"NSWorkspace\0".as_ptr() as *const _);
        if ws_class.is_null() { return Err("NSWorkspace class not found".into()); }
        let sel_shared   = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const _);
        let sel_running  = sel_registerName(b"runningApplications\0".as_ptr() as *const _);
        let sel_count    = sel_registerName(b"count\0".as_ptr() as *const _);
        let sel_obj_at   = sel_registerName(b"objectAtIndex:\0".as_ptr() as *const _);
        let sel_loc_name = sel_registerName(b"localizedName\0".as_ptr() as *const _);
        let sel_utf8     = sel_registerName(b"UTF8String\0".as_ptr() as *const _);
        let sel_activate = sel_registerName(b"activateWithOptions:\0".as_ptr() as *const _);

        type MsgId  = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
        type MsgIdx = unsafe extern "C" fn(*mut c_void, *mut c_void, usize) -> *mut c_void;
        type MsgU64 = unsafe extern "C" fn(*mut c_void, *mut c_void, u64) -> bool;
        type MsgCStr = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *const std::ffi::c_char;
        type MsgCnt = unsafe extern "C" fn(*mut c_void, *mut c_void) -> usize;

        let msg_id:   MsgId   = std::mem::transmute(objc_msgSend as *const ());
        let msg_idx:  MsgIdx  = std::mem::transmute(objc_msgSend as *const ());
        let msg_act:  MsgU64  = std::mem::transmute(objc_msgSend as *const ());
        let msg_cstr: MsgCStr = std::mem::transmute(objc_msgSend as *const ());
        let msg_cnt:  MsgCnt  = std::mem::transmute(objc_msgSend as *const ());

        let shared = msg_id(ws_class, sel_shared);
        let apps   = msg_id(shared, sel_running);
        let count  = msg_cnt(apps, sel_count);

        let target = app_name.to_lowercase();
        for i in 0..count {
            let app = msg_idx(apps, sel_obj_at, i);
            // localizedName returns NSString*, so we must call [nsString UTF8String]
            // to get a C string pointer. Treating NSString* as *const c_char directly
            // causes a SIGSEGV in strlen.
            let ns_string = msg_id(app, sel_loc_name);
            if ns_string.is_null() { continue; }
            let name_ptr = msg_cstr(ns_string, sel_utf8);
            if name_ptr.is_null() { continue; }
            let name = std::ffi::CStr::from_ptr(name_ptr)
                .to_string_lossy()
                .to_lowercase();
            if name == target || name.contains(&target) || target.contains(&name) {
                // NSApplicationActivateIgnoringOtherApps = 1 << 1 = 2
                msg_act(app, sel_activate, 2);
                return Ok(true);
            }
        }
        Ok(false)
    }
}

/// Simulate Cmd+V using CGEvents. Must be called from main thread for reliability.
pub fn post_cmd_v() -> Result<(), String> {
    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .map_err(|_| "Failed to create CGEventSource")?;

    // keycode 9 = 'v'
    let key_down = CGEvent::new_keyboard_event(source.clone(), 9, true)
        .map_err(|_| "Failed to create key-down event")?;
    let key_up = CGEvent::new_keyboard_event(source, 9, false)
        .map_err(|_| "Failed to create key-up event")?;

    key_down.set_flags(CGEventFlags::CGEventFlagCommand);
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);

    key_down.post(CGEventTapLocation::HID);
    std::thread::sleep(std::time::Duration::from_millis(50));
    key_up.post(CGEventTapLocation::HID);

    Ok(())
}
