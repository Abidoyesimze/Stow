//! Locked savings — deterministic, on-chain time locks.

use soroban_sdk::{Address, Env};

use crate::error::Error;
use crate::types::LockedPlan;

/// Create a locked plan that unlocks at `unlock_at` (ledger timestamp) and
/// fund it with an initial `amount`.
///
/// - `owner.require_auth()`, token transfer_in.
/// - Errors `InvalidUnlockTime` if `unlock_at <= now`.
/// - Returns the new plan id.
pub fn create(_env: &Env, _owner: Address, _amount: i128, _unlock_at: u64) -> Result<u64, Error> {
    // TODO(issue): validate, allocate id, transfer_in, store LockedPlan, emit event.
    unimplemented!("locked::create")
}

/// Add more funds to an existing locked plan (does not change unlock time).
pub fn top_up(_env: &Env, _owner: Address, _plan_id: u64, _amount: i128) -> Result<(), Error> {
    // TODO(issue): load plan, owner check, transfer_in, increment balance.
    unimplemented!("locked::top_up")
}

/// Withdraw from a locked plan. Only permitted once `now >= unlock_at`.
///
/// Errors: `StillLocked` before unlock, `InsufficientBalance` if over-withdrawing.
pub fn withdraw(_env: &Env, _owner: Address, _plan_id: u64, _amount: i128) -> Result<(), Error> {
    // TODO(issue): load plan, owner check, time check, transfer_out, update balance.
    unimplemented!("locked::withdraw")
}

pub fn get_plan(_env: &Env, _plan_id: u64) -> Result<LockedPlan, Error> {
    unimplemented!("locked::get_plan")
}
