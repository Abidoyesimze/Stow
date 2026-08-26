//! Group-split savings — a shared pool settled back to members by agreed shares.
//!
//! Shares are expressed in basis points (bps) and must sum to 10_000.

use soroban_sdk::{token, Address, Env, Map, Vec};

use crate::error::Error;
use crate::events::{TOPIC_GROUP_SHARES_SET, TOPIC_GROUP_SPLIT_SETTLED};
use crate::storage::extend_instance_ttl;
use crate::types::{DataKey, Group};

pub const TOTAL_BPS: u32 = 10_000;

/// Set the per-member split for a group. Creator-only, group must be closed.
///
/// Errors:
/// - `Unauthorized` if `creator` does not match the stored group creator.
/// - `GroupClosed` if the group has not been closed yet.
/// - `InvalidShares` if the bps values do not sum to exactly `TOTAL_BPS`,
///   or if any key is not a group member.
pub fn set_shares(
    env: &Env,
    creator: Address,
    group_id: u64,
    shares_bps: Map<Address, u32>,
) -> Result<(), Error> {
    extend_instance_ttl(env);
    creator.require_auth();

    let key = DataKey::Group(group_id);
    let mut group: Group = env.storage().persistent().get(&key).ok_or(Error::NotFound)?;

    if group.creator != creator {
        return Err(Error::Unauthorized);
    }
    if group.open {
        return Err(Error::GroupClosed);
    }

    let mut total: u32 = 0;
    for (member, bps) in shares_bps.iter() {
        if !group.members.iter().any(|m| m == member) {
            return Err(Error::InvalidShares);
        }
        total = total.checked_add(bps).ok_or(Error::InvalidShares)?;
    }
    if total != TOTAL_BPS {
        return Err(Error::InvalidShares);
    }

    group.shares_bps = shares_bps;
    env.storage().persistent().set(&key, &group);

    env.events().publish(
        (TOPIC_GROUP_SHARES_SET, creator.clone(), group_id),
        (group_id, creator, group.shares_bps.clone(), env.ledger().timestamp()),
    );

    Ok(())
}

/// Settle the pool: transfer each member `balance * shares_bps / TOTAL_BPS`.
///
/// - Permissionless once shares are configured; `caller` must still sign
///   (`require_auth`) so every settlement is attributable to a real signer.
/// - Deterministic and fully drains the pool: any rounding remainder from
///   floor division is assigned to the first member (the creator), matching
///   `group::payout_equal`'s convention.
/// - Errors `InvalidShares` if shares were never configured, `Overflow` if
///   any per-member computation would not fit in `i128`.
pub fn settle(env: &Env, caller: Address, group_id: u64) -> Result<(), Error> {
    extend_instance_ttl(env);
    caller.require_auth();

    let key = DataKey::Group(group_id);
    let mut group: Group = env.storage().persistent().get(&key).ok_or(Error::NotFound)?;

    if group.open {
        return Err(Error::GroupClosed);
    }
    if group.shares_bps.is_empty() {
        return Err(Error::InvalidShares);
    }

    let token_address: Address = env
        .storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(Error::NotInitialized)?;
    let token_client = token::Client::new(env, &token_address);
    let contract_address = env.current_contract_address();

    let total_balance = group.balance;
    let now = env.ledger().timestamp();

    // First pass: compute each member's floor share and the running sum, so
    // any rounding remainder can be assigned deterministically to the first
    // member (the creator) in the second pass — this is what guarantees the
    // pool is fully drained even when TOTAL_BPS doesn't divide it evenly.
    let mut shares: Vec<i128> = Vec::new(env);
    let mut distributed: i128 = 0;
    for member in group.members.iter() {
        let bps = group.shares_bps.get(member.clone()).unwrap_or(0);
        let raw = total_balance.checked_mul(bps as i128).ok_or(Error::Overflow)?;
        let share = raw.checked_div(TOTAL_BPS as i128).ok_or(Error::Overflow)?;
        distributed = distributed.checked_add(share).ok_or(Error::Overflow)?;
        shares.push_back(share);
    }
    let remainder = total_balance.checked_sub(distributed).ok_or(Error::Overflow)?;

    for (index, member) in group.members.iter().enumerate() {
        let mut share = shares.get(index as u32).unwrap();
        if index == 0 {
            share = share.checked_add(remainder).ok_or(Error::Overflow)?;
        }
        if share == 0 {
            continue;
        }

        token_client.transfer(&contract_address, &member, &share);

        env.events().publish(
            (TOPIC_GROUP_SPLIT_SETTLED, member.clone(), group_id),
            (group_id, member, share, now),
        );
    }

    group.balance = 0;
    env.storage().persistent().set(&key, &group);

    Ok(())
}
