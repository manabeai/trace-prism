use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use std::fs;
use std::io::{self, BufRead, BufReader};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, ProcessesToUpdate, System};

const MAX_TRACE_BYTES: u64 = 64 * 1024 * 1024;

pub fn list_runs(selected_id: Option<&str>) -> Result<Value, String> {
    let dir = traceprism::run_dir().map_err(|error| error.to_string())?;
    list_runs_in(&dir, selected_id)
}

fn list_runs_in(dir: &Path, selected_id: Option<&str>) -> Result<Value, String> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(json!({"runs": []})),
        Err(error) => return Err(format!("{}: {error}", dir.display())),
    };
    let mut runs = Vec::new();
    let mut errors = Vec::new();
    let mut system = System::new();
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                errors.push(error.to_string());
                continue;
            }
        };
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("jsonl") {
            continue;
        }
        match read_run_summary(&path, &mut system) {
            Ok(Some(run)) => runs.push(run),
            Ok(None) => {}
            Err(error) => errors.push(format!("{}: {error}", path.display())),
        }
    }
    runs.sort_by(|left, right| right["startedAt"].as_str().cmp(&left["startedAt"].as_str()));
    let selected = selected_id
        .and_then(|id| runs.iter().position(|run| run["id"].as_str() == Some(id)))
        .or_else(|| (!runs.is_empty()).then_some(0));
    if let Some(index) = selected {
        let id = runs[index]["id"].as_str().unwrap();
        let path = dir.join(format!("{id}.jsonl"));
        match read_frames(&path) {
            Ok(frames) => {
                runs[index]["frames"] = Value::Array(frames);
                runs[index]["loaded"] = Value::Bool(true);
            }
            Err(error) => errors.push(format!("{}: {error}", path.display())),
        }
    }
    Ok(json!({"runs": runs, "errors": errors}))
}

fn read_run_summary(path: &Path, system: &mut System) -> Result<Option<Value>, String> {
    let id = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("invalid file name")?;
    if !valid_id(id) {
        return Err("invalid run ID".to_owned());
    }
    let file_meta = fs::metadata(path).map_err(|error| error.to_string())?;
    if !file_meta.is_file() || file_meta.len() == 0 {
        return Ok(None);
    }
    if file_meta.len() > MAX_TRACE_BYTES {
        return Err("trace exceeds 64 MiB".to_owned());
    }
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let mut first_line = Vec::new();
    let first = loop {
        first_line.clear();
        reader
            .read_until(b'\n', &mut first_line)
            .map_err(|error| error.to_string())?;
        if first_line.last() != Some(&b'\n') {
            return Ok(None);
        }
        if first_line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        break serde_json::from_slice::<Value>(&first_line)
            .map_err(|error| format!("first record: {error}"))?;
    };
    let meta_path = path.with_file_name(format!("{id}.meta.json"));
    let saved_meta = match fs::read(&meta_path) {
        Ok(bytes) => {
            Some(serde_json::from_slice::<Value>(&bytes).map_err(|error| error.to_string())?)
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.to_string()),
    };
    let started_millis = saved_meta
        .as_ref()
        .and_then(|meta| meta["startedAt"].as_str())
        .and_then(|date| DateTime::parse_from_rfc3339(date).ok())
        .map(|date| date.timestamp_millis())
        .or_else(|| {
            id.strip_prefix("run-")
                .and_then(|tail| tail.split('-').next())
                .and_then(|value| value.parse::<i64>().ok())
        })
        .or_else(|| file_meta.created().ok().and_then(unix_millis))
        .or_else(|| file_meta.modified().ok().and_then(unix_millis))
        .ok_or("run start time is unavailable")?;
    let started_at = DateTime::<Utc>::from_timestamp_millis(started_millis)
        .ok_or("invalid run start time")?
        .to_rfc3339();
    let pid = saved_meta
        .as_ref()
        .and_then(|meta| meta["pid"].as_u64())
        .or_else(|| first["pid"].as_u64());
    let observed_millis = file_meta
        .created()
        .ok()
        .and_then(unix_millis)
        .or_else(|| file_meta.modified().ok().and_then(unix_millis))
        .unwrap_or(started_millis);
    let running = saved_meta
        .as_ref()
        .and_then(|meta| meta["status"].as_str())
        .is_none_or(|status| status == "running")
        && pid.is_some_and(|pid| process_is_run(system, pid, observed_millis));
    let status = saved_meta
        .as_ref()
        .and_then(|meta| meta["status"].as_str())
        .filter(|status| *status != "running")
        .unwrap_or(if running { "running" } else { "completed" });
    let duration_ms = saved_meta
        .as_ref()
        .and_then(|meta| meta["durationMs"].as_u64())
        .filter(|_| !running)
        .unwrap_or_else(|| {
            let end = if running {
                unix_millis(SystemTime::now()).unwrap_or(started_millis)
            } else {
                file_meta
                    .modified()
                    .ok()
                    .and_then(unix_millis)
                    .unwrap_or(started_millis)
            };
            end.saturating_sub(started_millis) as u64
        });
    Ok(Some(json!({
        "id": id,
        "source": saved_meta.as_ref().and_then(|meta| meta["source"].as_str()).or_else(|| first["source"]["file"].as_str()).unwrap_or("main.rs"),
        "input": saved_meta.as_ref().and_then(|meta| meta["input"].as_str()).unwrap_or("stdin"),
        "startedAt": started_at,
        "durationMs": duration_ms,
        "status": status,
        "loaded": false,
        "frames": [],
    })))
}

fn read_frames(path: &Path) -> Result<Vec<Value>, String> {
    if fs::metadata(path).map_err(|error| error.to_string())?.len() > MAX_TRACE_BYTES {
        return Err("trace exceeds 64 MiB".to_owned());
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let complete_len = bytes
        .iter()
        .rposition(|byte| *byte == b'\n')
        .map_or(0, |index| index + 1);
    bytes[..complete_len]
        .split(|byte| *byte == b'\n')
        .enumerate()
        .filter(|(_, line)| !line.is_empty())
        .map(|(index, line)| {
            serde_json::from_slice::<Value>(line)
                .map_err(|error| format!("line {}: {error}", index + 1))
        })
        .collect()
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn unix_millis(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
}

fn process_is_run(system: &mut System, pid: u64, observed_millis: i64) -> bool {
    let Ok(pid) = usize::try_from(pid) else {
        return false;
    };
    let pid = Pid::from(pid);
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    system.process(pid).is_some_and(|process| {
        let process_start = i64::try_from(process.start_time()).unwrap_or(i64::MAX) * 1000;
        process_start <= observed_millis + 5_000 && observed_millis - process_start < 86_400_000
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_incomplete_final_line_and_keeps_other_frames() {
        let dir = std::env::temp_dir().join(format!("traceprism-reader-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("run-1700000000000-1.jsonl");
        fs::write(
            &path,
            b"\n{\"pid\":1,\"source\":{\"file\":\"a.rs\"}}\n{\"seq\":\"1\"",
        )
        .unwrap();
        let run = read_run_summary(&path, &mut System::new())
            .unwrap()
            .unwrap();
        assert_eq!(run["frames"].as_array().unwrap().len(), 0);
        assert_eq!(read_frames(&path).unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn corrupted_run_does_not_hide_valid_run() {
        let dir = std::env::temp_dir().join(format!("traceprism-isolation-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("run-1700000000000-1.jsonl"), b"{broken}\n").unwrap();
        fs::write(dir.join("run-1700000000001-1.jsonl"), b"{\"pid\":1}\n").unwrap();
        let result = list_runs_in(&dir, None).unwrap();
        assert_eq!(result["runs"].as_array().unwrap().len(), 1);
        assert_eq!(result["errors"].as_array().unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn loads_frames_only_for_selected_run() {
        let dir = std::env::temp_dir().join(format!("traceprism-selection-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("run-1700000000000-1.jsonl"), b"{\"seq\":\"0\"}\n").unwrap();
        fs::write(
            dir.join("run-1700000000001-1.jsonl"),
            b"{\"seq\":\"0\"}\n{broken}\n",
        )
        .unwrap();
        let result = list_runs_in(&dir, Some("run-1700000000000-1")).unwrap();
        let runs = result["runs"].as_array().unwrap();
        assert_eq!(runs.len(), 2);
        assert_eq!(result["errors"].as_array().unwrap().len(), 0);
        assert_eq!(runs[0]["loaded"], false);
        assert_eq!(runs[0]["frames"].as_array().unwrap().len(), 0);
        assert_eq!(runs[1]["loaded"], true);
        assert_eq!(runs[1]["frames"].as_array().unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
}
