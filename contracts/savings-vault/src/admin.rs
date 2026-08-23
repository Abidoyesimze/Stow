//! Initialization and admin configuration.

use soroban_sdk::{Address, Env};

use crate::error::Error;

/// Initialize the vault.
///
/// - Stores `admin` and the `token` (SEP-41, e.g. USDC) address.
/// - Seeds id counters.
/// - Must be callable exactly once; subsequent calls -> `Error::AlreadyInitialized`.
///
/// Acceptance: after init, `token()` and `admin()` return the given values.
pub fn initialize(_env: &Env, _admin: Address, _token: Address) -> Result<(), Error> {
    // TODO(issue): guard against double init, persist admin + token, seed counters.
    unimplemented!("initialize")
}

/// Return the configured token address, or `Error::NotInitialized`.
pub fn token(_env: &Env) -> Result<Address, Error> {
    unimplemented!("token getter")
}

/// Rotate the admin. Requires `require_auth` from the current admin.
pub fn set_admin(_env: &Env, _new_admin: Address) -> Result<(), Error> {
    // TODO(issue): current admin require_auth, then overwrite DataKey::Admin.
    unimplemented!("set_admin")
}
