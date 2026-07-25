use insightarena_contract::config;
use insightarena_contract::{InsightArenaContract, InsightArenaContractClient, InsightArenaError};
use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{Address, Env, IntoVal};

fn deploy(env: &Env) -> InsightArenaContractClient<'_> {
    let id = env.register(InsightArenaContract, ());
    InsightArenaContractClient::new(env, &id)
}

fn register_token(env: &Env) -> Address {
    let token_admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(token_admin)
        .address()
}

#[test]
fn ensure_not_paused_ok_when_running() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));
    client.get_config();
}

#[test]
fn ensure_not_paused_err_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));
    client.set_paused(&true, &1u32);
    let result = client.try_get_config();
    assert!(matches!(result, Err(Ok(InsightArenaError::Paused))));
}

#[test]
fn ensure_not_paused_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let result = client.try_get_config();
    assert!(matches!(result, Err(Ok(InsightArenaError::NotInitialized))));
}

#[test]
fn ensure_not_paused_ok_after_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));
    client.set_paused(&true, &1u32);
    client.set_paused(&false, &0u32);
    client.get_config();
}

#[test]
fn test_config_update_validation() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);

    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let result = client.try_update_protocol_fee(&10_001_u32);
    assert!(matches!(result, Err(Ok(InsightArenaError::InvalidFee))));

    let config = client.get_config();
    assert_eq!(config.protocol_fee_bps, 200);
}

#[test]
fn test_pause_and_unpause_contract() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);

    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let result_before = client.try_get_config();
    assert!(result_before.is_ok());

    client.set_paused(&true, &1u32);
    let result_paused = client.try_get_config();
    assert!(matches!(result_paused, Err(Ok(InsightArenaError::Paused))));

    client.set_paused(&false, &0u32);
    let result_after = client.try_get_config();
    assert!(result_after.is_ok());
}

#[test]
fn test_update_platform_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);

    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let config_before = client.get_config();
    assert_eq!(config_before.protocol_fee_bps, 200);

    let new_fee = 500_u32;
    client.update_protocol_fee(&new_fee);

    let config_after = client.get_config();
    assert_eq!(config_after.protocol_fee_bps, 500);
}

#[test]
#[should_panic(expected = "Unauthorized function call")]
fn test_config_update_unauthorized() {
    let env = Env::default();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);

    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let _ = env.as_contract(&client.address, || config::set_paused(&env, true, 1u32));
}

#[test]
fn transfer_admin_revokes_old_admin_privileges() {
    let env = Env::default();
    let client = deploy(&env);
    let admin_a = Address::generate(&env);
    let admin_b = Address::generate(&env);
    let oracle = Address::generate(&env);

    client.initialize(&admin_a, &oracle, &200_u32, &register_token(&env));

    env.mock_auths(&[MockAuth {
        address: &admin_a,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer_admin",
            args: (admin_b.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.transfer_admin(&admin_b);
    assert_eq!(client.get_config().admin, admin_b);

    env.mock_auths(&[MockAuth {
        address: &admin_a,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "update_protocol_fee",
            args: (300_u32,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_update_protocol_fee(&300_u32).is_err());

    env.mock_auths(&[MockAuth {
        address: &admin_b,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "update_protocol_fee",
            args: (300_u32,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.update_protocol_fee(&300_u32);
    assert_eq!(client.get_config().protocol_fee_bps, 300);

    env.mock_auths(&[MockAuth {
        address: &admin_a,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "transfer_admin",
            args: (admin_a.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_transfer_admin(&admin_a).is_err());
    assert_eq!(client.get_config().admin, admin_b);
}

// ── Stake bounds (#1345) ──────────────────────────────────────────────────────

#[test]
fn set_stake_bounds_updates_config() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let cfg_before = client.get_config();
    assert_eq!(cfg_before.min_stake_xlm, 10_000_000);
    assert_eq!(cfg_before.max_stake_xlm, 1_000_000_000_000);

    client.set_stake_bounds(&admin, &5_000_000_i128, &50_000_000_i128);

    let cfg = client.get_config();
    assert_eq!(cfg.min_stake_xlm, 5_000_000);
    assert_eq!(cfg.max_stake_xlm, 50_000_000);
}

#[test]
fn set_stake_bounds_rejects_min_greater_than_max() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let result = client.try_set_stake_bounds(&admin, &100_i128, &50_i128);
    assert!(matches!(result, Err(Ok(InsightArenaError::InvalidInput))));

    let cfg = client.get_config();
    assert_eq!(cfg.min_stake_xlm, 10_000_000);
    assert_eq!(cfg.max_stake_xlm, 1_000_000_000_000);
}

#[test]
fn set_stake_bounds_rejects_non_positive() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    client.initialize(&admin, &oracle, &200_u32, &register_token(&env));

    let result = client.try_set_stake_bounds(&admin, &0_i128, &50_i128);
    assert!(matches!(result, Err(Ok(InsightArenaError::InvalidInput))));

    let result = client.try_set_stake_bounds(&admin, &10_i128, &0_i128);
    assert!(matches!(result, Err(Ok(InsightArenaError::InvalidInput))));
}
