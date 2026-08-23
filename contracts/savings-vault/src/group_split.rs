//! Group-split savings — a shared pool settled back to members by agreed shares.
//!
//! Shares are expressed in basis points (bps) and must sum to 10_000.

use soroban_sdk::{Address, Env, Map};

use crate::error::Error;

pub const TOTAL_BPS: u32 = 10_000;

/// Set the per-member split for a group. Creator-only, group must be closed.
///
/// Errors:
/// - `InvalidShares` if the bps values do not sum to exactly `TOTAL_BPS`,
///   or if any key is not a group member.
pub fn set_shares(
    _env: &Env,
    _creator: Address,
    _group_id: u64,
    _shares_bps: Map<Address, u32>,
) -> Result<(), Error> {
    // TODO(issue): creator auth, closed check, validate sum == TOTAL_BPS and
    //              keys ⊆ members, persist Group.shares_bps.
    unimplemented!("group_split::set_shares")
}

/// Settle the pool: transfer each member `balance * shares_bps / TOTAL_BPS`.
///
/// - Must be deterministic and fully drain the pool (assign any rounding
///   remainder to a defined recipient, e.g. the creator).
/// - Errors `InvalidShares` if shares were never configured.
pub fn settle(_env: &Env, _caller: Address, _group_id: u64) -> Result<(), Error> {
    // TODO(issue): load group + shares, compute per-member amounts, transfer_out,
    //              reconcile remainder, zero pool, emit `group_split_settled` event.
    unimplemented!("group_split::settle")
}
