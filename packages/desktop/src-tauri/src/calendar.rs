use serde::Serialize;

#[derive(Serialize, Clone)]
pub(crate) struct CalendarAttendee {
    name: String,
    email: String,
}

#[derive(Serialize, Clone)]
pub(crate) struct CalendarEvent {
    title: String,
    start_time: String,
    end_time: String,
    start_at: String,
    end_at: String,
    attendees: Vec<CalendarAttendee>,
    organizer_email: String,
    calendar_name: String,
}

/// Fetch calendar events from the Google Calendar API using the user's OAuth provider token.
///
/// - `token`    – Google OAuth access token (provider_token from Supabase)
/// - `time_min` – RFC3339 start of the window, e.g. "2024-06-01T00:00:00Z"
/// - `time_max` – RFC3339 end of the window
///
/// Returns `Err("NEEDS_RECONNECT")` on HTTP 401 so the frontend can prompt the user
/// to reconnect their Google account.
#[tauri::command]
pub async fn get_calendar_events(
    token: String,
    time_min: String,
    time_max: String,
) -> Result<Vec<CalendarEvent>, String> {
    if token.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events\
         ?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=30",
        time_min, time_max
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Calendar API request failed: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("NEEDS_RECONNECT".into());
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Calendar API error {status}: {body}"));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse calendar response: {e}"))?;

    let items = match body.get("items").and_then(|v| v.as_array()) {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut events: Vec<CalendarEvent> = items
        .iter()
        .filter_map(|item| {
            let title = item.get("summary")?.as_str()?.trim().to_string();
            if title.is_empty() {
                return None;
            }

            let event_type = item
                .get("eventType")
                .and_then(|v| v.as_str())
                .unwrap_or("default");
            if event_type != "default" {
                return None;
            }

            if item.pointer("/start/dateTime").is_none() {
                return None;
            }

            let start_time = item
                .pointer("/start/dateTime")
                .and_then(|v| v.as_str())
                .map(format_rfc3339_time)
                .or_else(|| {
                    item.pointer("/start/date")
                        .and_then(|v| v.as_str())
                        .map(|date| date.to_string())
                })
                .unwrap_or_default();

            let start_at = item
                .pointer("/start/dateTime")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .unwrap_or_default();

            let end_time = item
                .pointer("/end/dateTime")
                .and_then(|v| v.as_str())
                .map(format_rfc3339_time)
                .or_else(|| {
                    item.pointer("/end/date")
                        .and_then(|v| v.as_str())
                        .map(|date| date.to_string())
                })
                .unwrap_or_default();

            let end_at = item
                .pointer("/end/dateTime")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .unwrap_or_default();

            let attendees: Vec<CalendarAttendee> = item
                .get("attendees")
                .and_then(|attendees| attendees.as_array())
                .map(|attendees| {
                    attendees
                        .iter()
                        .filter_map(|attendee| {
                            let email = attendee
                                .get("email")
                                .and_then(|value| value.as_str())
                                .unwrap_or_default()
                                .trim()
                                .to_string();
                            let name = attendee
                                .get("displayName")
                                .and_then(|value| value.as_str())
                                .unwrap_or_else(|| email.as_str())
                                .trim()
                                .to_string();

                            if name.is_empty() && email.is_empty() {
                                None
                            } else {
                                Some(CalendarAttendee { name, email })
                            }
                        })
                        .collect()
                })
                .unwrap_or_default();

            let organizer_email = item
                .pointer("/organizer/email")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();

            Some(CalendarEvent {
                title,
                start_time,
                end_time,
                start_at,
                end_at,
                attendees,
                organizer_email,
                calendar_name: "Google Calendar".into(),
            })
        })
        .collect();

    events.sort_by(|a, b| a.start_at.cmp(&b.start_at));
    Ok(events)
}

/// Extract "HH:MM" from an RFC3339 datetime string like "2024-06-01T14:30:00+05:30".
fn format_rfc3339_time(dt: &str) -> String {
    if dt.len() >= 16 {
        dt[11..16].to_string()
    } else {
        dt.to_string()
    }
}
