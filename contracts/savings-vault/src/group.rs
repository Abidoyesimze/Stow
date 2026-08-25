//! Group savings — shared pools with contract-enforced rules and payouts.

use soroban_sdk::{Address, Env, Map, String, Vec};

use crate::error::Error;
use crate::events::{TOPIC_GROUP_CREATED};
use crate::storage::extend_instance_ttl;
use crate::types::{DataKey, Group};

/// Create a group pool. The creator is the first member.
///
/// Returns the new group id. `open == true` until `close` is called.
pub fn create(env: &Env, creator: Address, name: String) -> Result<u64, Error> {
    extend_instance_ttl(env);
    creator.require_auth();

    // Allocate a new group id
    let id = next_group_id(env);

    // Create members vector with creator as the sole member
    let mut members = Vec::new(env);
    members.push_back(creator.clone());

    // Create the group with open = true and zero balance
    let group = Group {
        id,
        creator: creator.clone(),
        name: name.clone(),
        members,
        balance: 0,
        shares_bps: Map::new(env),
        open: true,
        created_at: env.ledger().timestamp(),
    };

    // Store the group
    env.storage()
        .persistent()
        .set(&DataKey::Group(id), &group);

    // Emit group-created event
    env.events()
        .publish((TOPIC_GROUP_CREATED,), (id, creator, name));

    Ok(id)
}

/// Join an open group.
///
/// Errors `GroupClosed` if the group is not accepting members.
pub fn join(env: &Env, member: Address, group_id: u64) -> Result<(), Error> {
    extend_instance_ttl(env);
    member.require_auth();

    // Load the group
    let mut group: Group = env
        .storage()
        .persistent()
        .get(&DataKey::Group(group_id))
        .ok_or(Error::NotFound)?;

    // Check if the group is open
    if !group.open {
        return Err(Error::GroupClosed);
    }

    // Check if member is already in the group (idempotent)
    let already_member = group.members.iter().any(|m| m == member);
    
    if !already_member {
        // Add member to the group
        group.members.push_back(member.clone());

        // Save the updated group
        env.storage()
            .persistent()
            .set(&DataKey::Group(group_id), &group);

        // Emit group-joined event
        env.events()
            .publish((crate::events::TOPIC_GROUP_JOINED,), (group_id, member));
    }

    Ok(())
}

/// Contribute `amount` into the shared pool.
///
/// Errors `NotAMember` if the caller has not joined.
pub fn contribute(_env: &Env, _member: Address, _group_id: u64, _amount: i128) -> Result<(), Error> {
    // TODO(issue): auth, membership check, transfer_in, increment pool balance, event.
    unimplemented!("group::contribute")
}

/// Close the group to new members and lock the membership set so shares can
/// be settled. Creator-only.
pub fn close(_env: &Env, _creator: Address, _group_id: u64) -> Result<(), Error> {
    // TODO(issue): creator auth, set open = false, emit event.
    unimplemented!("group::close")
}

/// Equal-split payout: divide the pool balance evenly across members and
/// transfer each member their share. See `group_split` for weighted payouts.
pub fn payout_equal(_env: &Env, _caller: Address, _group_id: u64) -> Result<(), Error> {
    // TODO(issue): closed check, compute balance / members.len(), transfer_out each,
    //              handle remainder deterministically, zero the pool, emit event.
    unimplemented!("group::payout_equal")
}

pub fn get_group(env: &Env, group_id: u64) -> Result<Group, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Group(group_id))
        .ok_or(Error::NotFound)
}

/// Helper to allocate the next group id.
fn next_group_id(env: &Env) -> u64 {
    let key = DataKey::NextGroupId;
    let current: u64 = env.storage().instance().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&key, &next);
    next
}
