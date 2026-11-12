use serde::{Serialize, Serializer};

/// Error type shared by all Tauri commands.
///
/// Serialized to the frontend as `{ kind, message, currentMtime? }` so the UI can
/// react to specific failures (most importantly save conflicts).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("file is not valid UTF-8")]
    NotUtf8,
    #[error("path not found: {0}")]
    NotFound(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("file changed on disk")]
    Conflict { current_mtime: u64 },
    #[error("{0}")]
    Other(String),
}

#[derive(Serialize)]
struct ErrorPayload<'a> {
    kind: &'a str,
    message: String,
    #[serde(rename = "currentMtime", skip_serializing_if = "Option::is_none")]
    current_mtime: Option<u64>,
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let (kind, current_mtime) = match self {
            AppError::Io(_) => ("io", None),
            AppError::NotUtf8 => ("notUtf8", None),
            AppError::NotFound(_) => ("notFound", None),
            AppError::InvalidPath(_) => ("invalidPath", None),
            AppError::Conflict { current_mtime } => ("conflict", Some(*current_mtime)),
            AppError::Other(_) => ("other", None),
        };
        ErrorPayload {
            kind,
            message: self.to_string(),
            current_mtime,
        }
        .serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;
