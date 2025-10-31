// Ubuntu Config Scripts - Main Library Entry Point
//
// This is the main library entry point for the Ubuntu configuration scripts.
// All modules are organized under this main library structure.

pub mod lib {
    pub mod common;
    pub mod deploy;
    pub mod deps_manager;
    pub mod logger;
    pub mod schema;
}

// Re-export commonly used items for convenience
pub use lib::common::*;
pub use lib::deps_manager::*;
pub use lib::logger::*;
pub use lib::schema::*;
