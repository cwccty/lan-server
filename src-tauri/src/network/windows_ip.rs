use std::process::Command;

use crate::core::process_util::hide_console_window;

pub fn find_ipv4_by_interface_keywords(keywords: &[&str]) -> Option<String> {
    find_by_get_net_ip_address(keywords).or_else(|| find_by_ipconfig(keywords))
}

fn find_by_get_net_ip_address(keywords: &[&str]) -> Option<String> {
    let keyword_regex = keywords.join("|");
    let command = format!(
        "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {{ $_.InterfaceAlias -match '{}' }} | Select-Object -First 1 -ExpandProperty IPAddress",
        keyword_regex
    );
    let mut process = Command::new("powershell");
    process.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &command,
    ]);
    let output = hide_console_window(&mut process).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .map(str::trim)
        .find(|line| is_ipv4(line))
        .map(ToString::to_string)
}

fn find_by_ipconfig(keywords: &[&str]) -> Option<String> {
    let mut command = Command::new("ipconfig");
    let output = hide_console_window(&mut command).output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let mut matched_section = false;

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            matched_section = false;
            continue;
        }

        let lowered = trimmed.to_ascii_lowercase();
        if keywords
            .iter()
            .any(|keyword| lowered.contains(&keyword.to_ascii_lowercase()))
        {
            matched_section = true;
            continue;
        }

        if matched_section && trimmed.contains("IPv4") {
            let (_, value) = trimmed.split_once(':')?;
            let ip = value.trim().trim_end_matches("(首选)").trim();
            if is_ipv4(ip) {
                return Some(ip.to_string());
            }
        }
    }

    None
}

fn is_ipv4(value: &str) -> bool {
    let parts: Vec<&str> = value.split('.').collect();
    parts.len() == 4 && parts.iter().all(|part| part.parse::<u8>().is_ok())
}
