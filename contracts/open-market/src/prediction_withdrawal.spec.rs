// Integration tests for partial position withdrawal feature.
// Tests cover: partial withdrawals, full withdrawals, post-lock rejections, and fee distribution.

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testutils::*;

    /// Test: Partial withdrawal reduces stake and market pool by exact withdrawn amount.
    /// Fee is deducted from withdrawal, and remainder is refunded.
    #[test]
    fn test_partial_withdrawal_reduces_position() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000); // min, max, end_time
        let predictor = Address::random(&env);
        let initial_stake = 50_000i128;

        // Predictor stakes initial amount
        submit_prediction(&env, predictor.clone(), market_id, initial_stake);

        let market_before = market::get_market(&env, market_id).unwrap();
        assert_eq!(market_before.total_pool, initial_stake);

        // Withdraw 20_000 (40% of stake)
        let withdrawal_amount = 20_000i128;
        let (refund, fee) = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            withdrawal_amount,
        )
        .unwrap();

        // Fee should be 5% (500 bps) by default: 20_000 * 500 / 10_000 = 1_000
        assert_eq!(fee, 1_000);
        assert_eq!(refund, 19_000); // withdrawal_amount - fee
        assert_eq!(refund + fee, withdrawal_amount); // Conservation check

        let market_after = market::get_market(&env, market_id).unwrap();
        assert_eq!(
            market_after.total_pool,
            initial_stake - withdrawal_amount,
            "market pool should decrease by exactly withdrawn amount"
        );

        let pred_after = prediction::get_prediction(&env, market_id, predictor.clone()).unwrap();
        assert_eq!(
            pred_after.stake_amount,
            initial_stake - withdrawal_amount,
            "predictor stake should be reduced"
        );
    }

    /// Test: Full withdrawal (stake goes to zero) removes predictor from market.
    #[test]
    fn test_full_withdrawal_removes_predictor() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let market_before = market::get_market(&env, market_id).unwrap();
        assert_eq!(market_before.participant_count, 1);

        // Withdraw full amount
        let (refund, fee) = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            stake,
        )
        .unwrap();

        assert_eq!(fee, stake * 500 / 10_000); // 5% fee
        assert_eq!(refund + fee, stake);

        let market_after = market::get_market(&env, market_id).unwrap();
        assert_eq!(
            market_after.participant_count, 0,
            "predictor should be removed from market"
        );
        assert_eq!(market_after.total_pool, 0);

        // Attempting to get prediction after full exit should fail
        let result = prediction::get_prediction(&env, market_id, predictor.clone());
        assert!(result.is_err(), "prediction should not exist after full exit");
    }

    /// Test: Withdrawals are rejected after market lock time (end_time).
    #[test]
    fn test_withdrawal_rejected_after_lock_time() {
        let env = Env::default();
        let now = env.ledger().timestamp();
        let end_time = now + 1000;
        let market_id = create_test_market(&env, 1000, 100_000, end_time);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        // Advance time past end_time
        env.ledger().set_timestamp(end_time + 1);

        let result = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            10_000,
        );

        assert!(
            result.is_err_with(InsightArenaError::WithdrawalAfterLockTime),
            "withdrawal must be rejected after lock time"
        );
    }

    /// Test: Withdrawal amount must be positive.
    #[test]
    fn test_withdrawal_rejects_zero_amount() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let result = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            0,
        );

        assert!(
            result.is_err_with(InsightArenaError::InvalidWithdrawalAmount),
            "zero withdrawal must be rejected"
        );

        let result_negative = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            -1000,
        );

        assert!(
            result_negative.is_err_with(InsightArenaError::InvalidWithdrawalAmount),
            "negative withdrawal must be rejected"
        );
    }

    /// Test: Cannot withdraw more than current stake.
    #[test]
    fn test_withdrawal_rejects_excess_amount() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let result = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            stake + 1,
        );

        assert!(
            result.is_err_with(InsightArenaError::WithdrawalExceedsStake),
            "cannot withdraw more than stake"
        );
    }

    /// Test: Early-exit fee is conserved (distributed to remaining participants).
    /// Multiple predictors on different outcomes should each receive pro-rata shares.
    #[test]
    fn test_early_exit_fee_distributed_to_participants() {
        let env = Env::default();
        let market_id = create_test_market_with_outcomes(
            &env,
            1000,
            100_000,
            1000,
            vec!["YES", "NO"],
        );
        let predictor_a = Address::random(&env);
        let predictor_b = Address::random(&env);
        let stake_a = 50_000i128;
        let stake_b = 30_000i128;

        // Both predict on same market (but different outcomes; on same outcome if multi-choice)
        submit_prediction_with_outcome(&env, predictor_a.clone(), market_id, stake_a, "YES");
        submit_prediction_with_outcome(&env, predictor_b.clone(), market_id, stake_b, "NO");

        let market_before = market::get_market(&env, market_id).unwrap();
        let total_before = market_before.total_pool;
        assert_eq!(total_before, stake_a + stake_b);

        // Predictor A withdraws 10_000
        let withdrawal = 10_000i128;
        let (refund_a, fee) = prediction::withdraw_position(
            &env,
            predictor_a.clone(),
            market_id,
            withdrawal,
        )
        .unwrap();

        // Fee is 5%: 10_000 * 500 / 10_000 = 500
        assert_eq!(fee, 500);
        assert_eq!(refund_a, 9_500);

        let market_after = market::get_market(&env, market_id).unwrap();
        // Total pool should decrease by withdrawal amount
        assert_eq!(market_after.total_pool, total_before - withdrawal);

        // Predictor B should have gained fee pro-rata
        // remaining_pool_after_a_exits = 40_000 + 30_000 = 70_000
        // b_share = 500 * 30_000 / 70_000 ≈ 214 (with integer division)
        let pred_b = prediction::get_prediction(&env, market_id, predictor_b.clone()).unwrap();
        let b_expected_gain = fee * stake_b / (stake_a - withdrawal + stake_b);
        assert!(pred_b.stake_amount > stake_b, "B should gain some fee");
        assert_eq!(pred_b.stake_amount, stake_b + b_expected_gain);
    }

    /// Test: Early-exit fee configuration can be updated and affects withdrawals.
    #[test]
    fn test_early_exit_fee_configuration() {
        let env = Env::default();
        let admin = Address::random(&env);
        setup_contract(&env, admin.clone());

        // Set early-exit fee to 10% (1000 bps)
        config::set_early_exit_fee_bps(&env, admin, 1000).unwrap();

        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let withdrawal = 20_000i128;
        let (refund, fee) = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            withdrawal,
        )
        .unwrap();

        // Fee should now be 10%: 20_000 * 1000 / 10_000 = 2_000
        assert_eq!(fee, 2_000);
        assert_eq!(refund, 18_000);
    }

    /// Test: Multiple sequential withdrawals by same predictor.
    #[test]
    fn test_sequential_withdrawals() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let initial_stake = 100_000i128;

        submit_prediction(&env, predictor.clone(), market_id, initial_stake);

        // First withdrawal: 30_000
        let (refund1, fee1) = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            30_000,
        )
        .unwrap();
        assert_eq!(fee1, 1_500); // 5% of 30_000

        let after_first = prediction::get_prediction(&env, market_id, predictor.clone()).unwrap();
        assert_eq!(after_first.stake_amount, 70_000);

        // Second withdrawal: 20_000
        let (refund2, fee2) = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            20_000,
        )
        .unwrap();
        assert_eq!(fee2, 1_000); // 5% of 20_000

        let after_second = prediction::get_prediction(&env, market_id, predictor.clone()).unwrap();
        assert_eq!(after_second.stake_amount, 50_000);

        let market = market::get_market(&env, market_id).unwrap();
        assert_eq!(market.total_pool, 50_000);
    }

    /// Test: Market with no remaining participants after someone withdraws fully.
    #[test]
    fn test_market_empty_after_withdrawal() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let market_before = market::get_market(&env, market_id).unwrap();
        assert_eq!(market_before.participant_count, 1);

        // Full exit
        prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            stake,
        )
        .unwrap();

        let market_after = market::get_market(&env, market_id).unwrap();
        assert_eq!(market_after.participant_count, 0);
        assert_eq!(market_after.total_pool, 0);

        // No fee distribution to non-existent participants
    }

    /// Test: Withdrawal estimate function returns correct fee and refund.
    #[test]
    fn test_get_early_exit_fee_estimate() {
        let env = Env::default();
        setup_contract(&env, Address::random(&env));

        let withdrawal = 100_000i128;
        let (refund, fee) = prediction::get_early_exit_fee_estimate(&env, withdrawal).unwrap();

        // Default 5% fee
        assert_eq!(fee, 5_000);
        assert_eq!(refund, 95_000);
        assert_eq!(refund + fee, withdrawal);
    }

    /// Test: Rejection on resolved market.
    #[test]
    fn test_withdrawal_rejected_on_resolved_market() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        // Resolve the market
        let oracle = Address::random(&env);
        market::resolve_market(&env, oracle, market_id, Symbol::new(&env, "YES")).unwrap();

        let result = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            10_000,
        );

        assert!(
            result.is_err_with(InsightArenaError::MarketAlreadyResolved),
            "withdrawal must be rejected on resolved market"
        );
    }

    /// Test: Rejection on cancelled market.
    #[test]
    fn test_withdrawal_rejected_on_cancelled_market() {
        let env = Env::default();
        let admin = Address::random(&env);
        setup_contract(&env, admin.clone());

        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        // Cancel the market
        market::cancel_market(&env, admin, market_id).unwrap();

        let result = prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            10_000,
        );

        assert!(
            result.is_err_with(InsightArenaError::MarketAlreadyCancelled),
            "withdrawal must be rejected on cancelled market"
        );
    }

    /// Test: UserProfile stats are correctly updated after withdrawal.
    #[test]
    fn test_user_profile_updated_after_withdrawal() {
        let env = Env::default();
        let market_id = create_test_market(&env, 1000, 100_000, 1000);
        let predictor = Address::random(&env);
        let stake = 50_000i128;

        submit_prediction(&env, predictor.clone(), market_id, stake);

        let profile_before = market::get_user_stats(&env, predictor.clone()).unwrap();
        assert_eq!(profile_before.total_staked, stake);

        // Withdraw 20_000
        prediction::withdraw_position(
            &env,
            predictor.clone(),
            market_id,
            20_000,
        )
        .unwrap();

        let profile_after = market::get_user_stats(&env, predictor.clone()).unwrap();
        assert_eq!(profile_after.total_staked, stake - 20_000);
    }
}
