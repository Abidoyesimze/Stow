//! Group savings — shared pools with contract-enforced rules and payouts.

use soroban_sdk::{Address, Env, String};

use crate::error::Error;
use crate::types::Group;

/// Create a group pool. The creator is the first member.
///
/// Returns the new group id. `open == true` until `close` is called.
pub fn create(_env: &Env, _creator: Address, _name: String) -> Result<u64, Error> {
    // TODO(issue): allocate id, store Group with creator as sole member, emit event.
    unimplemented!("group::create")
}

/// Join an open group.
///
/// Errors `GroupClosed` if the group is not accepting members.
pub fn join(_env: &Env, _member: Address, _group_id: u64) -> Result<(), Error> {
    // TODO(issue): auth, open check, add to members (idempotent), emit event.
    unimplemented!("group::join")
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

pub fn get_group(_env: &Env, _group_id: u64) -> Result<Group, Error> {
    unimplemented!("group::get_group")
}
