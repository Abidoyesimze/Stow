//! Flexible savings — deposit and withdraw any time.

use soroban_sdk::{Address, Env};

use crate::error::Error;
use crate::types::FlexibleAccount;

/// Deposit `amount` of the vault token into the caller's flexible account.
///
/// - `from.require_auth()`.
/// - Transfers tokens from `from` into the contract.
/// - Creates the account on first deposit; increments balance otherwise.
/// - Emits a `deposit` event.
///
/// Errors: `InvalidAmount` if `amount <= 0`.
pub fn deposit(_env: &Env, _from: Address, _amount: i128) -> Result<(), Error> {
    // TODO(issue): auth, validate, token transfer_in, update FlexibleAccount, emit event.
    unimplemented!("flexible::deposit")
}

/// Withdraw `amount` from the caller's flexible account back to their wallet.
///
/// - `owner.require_auth()`.
/// - Errors `InsufficientBalance` if `amount > balance`.
/// - Transfers tokens out and decrements balance.
/// - Emits a `withdraw` event.
pub fn withdraw(_env: &Env, _owner: Address, _amount: i128) -> Result<(), Error> {
    // TODO(issue): auth, balance check, token transfer_out, update account, emit event.
    unimplemented!("flexible::withdraw")
}

/// Read the caller's flexible account (or `NotFound`).
pub fn get_account(_env: &Env, _owner: Address) -> Result<FlexibleAccount, Error> {
    unimplemented!("flexible::get_account")
}
