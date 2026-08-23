#![cfg(test)]
//! Test skeleton. Each `#[ignore]`d test is a placeholder for a contributor.
//!
//! Pattern: register the contract, register a SEP-41 token (StellarAssetClient
//! from `soroban_sdk::testutils`), initialize, then exercise the entrypoint.

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{SavingsVault, SavingsVaultClient};

fn setup(env: &Env) -> SavingsVaultClient {
    let contract_id = env.register(SavingsVault, ());
    SavingsVaultClient::new(env, &contract_id)
}

#[test]
#[ignore = "TODO(issue): initialize stores admin + token"]
fn initialize_sets_config() {
    let env = Env::default();
    let _client = setup(&env);
    let _admin = Address::generate(&env);
    // TODO: initialize and assert token()/admin readback.
}

#[test]
#[ignore = "TODO(issue): flexible deposit then withdraw round-trips balance"]
fn flexible_deposit_withdraw() {}

#[test]
#[ignore = "TODO(issue): locked withdraw before unlock_at returns StillLocked"]
fn locked_respects_time_lock() {}

#[test]
#[ignore = "TODO(issue): goal contribute crossing target sets reached_at"]
fn goal_reaches_target() {}

#[test]
#[ignore = "TODO(issue): group_split settle pays members by shares and drains pool"]
fn group_split_settles_by_shares() {}
