//! Goal-based savings — save toward a target with automated milestones.

use soroban_sdk::{Address, Env, String};

use crate::error::Error;
use crate::types::Goal;

/// Create a savings goal with a `target_amount`.
///
/// - `owner.require_auth()`.
/// - Errors `InvalidAmount` if `target_amount <= 0`.
/// - Returns the new goal id.
pub fn create(_env: &Env, _owner: Address, _name: String, _target_amount: i128) -> Result<u64, Error> {
    // TODO(issue): validate, allocate id, store Goal (saved_amount = 0), emit event.
    unimplemented!("goal::create")
}

/// Contribute `amount` toward a goal. When cumulative `saved_amount` first
/// reaches `target_amount`, set `reached_at` and emit a `goal_reached` event.
pub fn contribute(_env: &Env, _from: Address, _goal_id: u64, _amount: i128) -> Result<(), Error> {
    // TODO(issue): auth, transfer_in, increment saved_amount, milestone check, events.
    unimplemented!("goal::contribute")
}

/// Withdraw funds from a reached goal back to the owner.
///
/// Errors `GoalNotReached` if the target has not been met yet.
pub fn claim(_env: &Env, _owner: Address, _goal_id: u64) -> Result<(), Error> {
    // TODO(issue): owner check, reached check, transfer_out full balance, close goal.
    unimplemented!("goal::claim")
}

pub fn get_goal(_env: &Env, _goal_id: u64) -> Result<Goal, Error> {
    unimplemented!("goal::get_goal")
}
