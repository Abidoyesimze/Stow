//! Storage helpers and TTL management.
//!
//! Centralize all `env.storage()` access here so the persistence strategy
//! (instance vs. persistent, TTL bumping) lives in one place.

use soroban_sdk::{Address, Env};

use crate::types::DataKey;

// --- TTL constants (ledgers) --------------------------------------------
// TODO(issue): tune these for mainnet. Roughly: 1 ledger ~= 5s.
pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

/// Bump the instance TTL. Call at the top of every state-changing entrypoint.
pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

/// The token (e.g. USDC) this vault custodies.
pub fn get_token(_env: &Env) -> Address {
    // TODO(issue): read DataKey::Token from instance storage.
    unimplemented!("read token address")
}

pub fn set_token(_env: &Env, _token: &Address) {
    // TODO(issue): persist DataKey::Token.
    unimplemented!("set token address")
}

pub fn get_admin(_env: &Env) -> Address {
    // TODO(issue): read DataKey::Admin.
    unimplemented!("read admin")
}

/// Allocate and persist the next id for the given counter key.
pub fn next_id(_env: &Env, _key: DataKey) -> u64 {
    // TODO(issue): read counter, increment, write back, return new id.
    unimplemented!("id allocation")
}
