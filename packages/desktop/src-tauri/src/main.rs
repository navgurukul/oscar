// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
use std::sync::Arc;

fn main() {
    #[cfg(target_os = "macos")]
    setup_macos_deep_link_handler();

    voiceapp_lib::run()
}

#[cfg(target_os = "macos")]
fn setup_macos_deep_link_handler() {
    use cocoa::base::{id, nil, YES};
    use cocoa::foundation::NSString;
    use objc::declare::ClassDecl;
    use objc::runtime::{Class, Object, Sel};
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        // Create a delegate class to handle URL events
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("AppDelegate", superclass).unwrap();

        decl.add_method(
            sel!(application:openURLs:),
            handle_open_urls as extern "C" fn(&Object, Sel, id, id),
        );

        let delegate_class = decl.register();

        // Set the delegate
        let app: id = msg_send![class!(NSApplication), sharedApplication];
        let delegate: id = msg_send![delegate_class, alloc];
        let delegate: id = msg_send![delegate, init];
        let _: () = msg_send![app, setDelegate: delegate];
    }
}

#[cfg(target_os = "macos")]
extern "C" fn handle_open_urls(_this: &objc::runtime::Object, _cmd: objc::runtime::Sel, _app: id, urls: id) {
    use cocoa::foundation::NSArray;
    use objc::runtime::Object;
    use std::ffi::CStr;

    unsafe {
        let count: usize = msg_send![urls, count];
        for i in 0..count {
            let url: *mut Object = msg_send![urls, objectAtIndex: i];
            let absolute_string: *mut Object = msg_send![url, absoluteString];
            let c_str: *const i8 = msg_send![absolute_string, UTF8String];
            if !c_str.is_null() {
                let url_str = CStr::from_ptr(c_str).to_string_lossy().to_string();
                log::info!("Received deep link: {}", url_str);
                voiceapp_lib::set_pending_deep_link(url_str);
            }
        }
    }
}
