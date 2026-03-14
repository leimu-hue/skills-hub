use std::sync::atomic::{AtomicBool, Ordering};

/// Shared cancellation flag for long-running operations.
/// Managed as Tauri state so both commands and core logic can access it.
#[derive(Debug, Default)]
pub struct CancelToken {
    cancelled: AtomicBool,
}

impl CancelToken {
    pub fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
        }
    }

    /// Request cancellation.
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Reset the flag (call before starting a new operation).
    pub fn reset(&self) {
        self.cancelled.store(false, Ordering::SeqCst);
    }

    /// Check if cancellation was requested.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}
