use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

use crate::errors::InsightArenaError;
use crate::storage_types::DataKey;

// ── TTL constants ─────────────────────────────────────────────────────────────
// Assuming ~5 s per ledger:
//   PERSISTENT_BUMP      ≈ 30 days  (518 400 ledgers)
//   PERSISTENT_THRESHOLD ≈ 29 days  — only bump when remaining TTL falls below this
pub const PERSISTENT_BUMP: u32 = 518_400;
pub const PERSISTENT_THRESHOLD: u32 = 501_120; // PERSISTENT_BUMP − 1 day

// ── Governance timelock defaults ──────────────────────────────────────────────
/// Default delay (seconds) a passed governance proposal must sit in the queue
/// before it becomes executable. ~2 days at real time. Admin-configurable via
/// [`set_timelock_delay`].
pub const DEFAULT_TIMELOCK_DELAY: u64 = 172_800;

// ── Storage-specific TTL constants (merged from ttl.rs) ───────────────────────
// ~30 days at ~6s/ledger for frequently accessed market state.
pub const LEDGER_BUMP_MARKET: u32 = 432_000;
// ~7 days for prediction records after payout is claimed.
pub const LEDGER_BUMP_PREDICTION_CLAIMED: u32 = 100_800;
// ~90 days for long-lived user profiles.
pub const LEDGER_BUMP_USER: u32 = 1_296_000;
// ~7 days for short-lived invite code records.
pub const LEDGER_BUMP_INVITE: u32 = 100_800;
// ~1 year for global config and season snapshots.
pub const LEDGER_BUMP_PERMANENT: u32 = 5_184_000;

fn ttl_threshold(max: u32) -> u32 {
    max.saturating_sub(14_400)
}

pub fn extend_market_ttl(env: &Env, market_id: u64) {
    let extension = market_ttl_extension_amount(env);
    env.storage().persistent().extend_ttl(
        &DataKey::Market(market_id),
        ttl_threshold(extension),
        extension,
    );
}

/// Number of ledgers to extend a market's TTL by on each interaction and via
/// the explicit `market::extend_market_ttl` maintenance entrypoint. Reads the
/// admin-configurable `Config::market_ttl_extension`, falling back to
/// `LEDGER_BUMP_MARKET` if the contract has not been initialized yet.
fn market_ttl_extension_amount(env: &Env) -> u32 {
    get_config_readonly(env)
        .map(|c| c.market_ttl_extension)
        .unwrap_or(LEDGER_BUMP_MARKET)
}

pub fn extend_prediction_ttl(env: &Env, market_id: u64, predictor: &Address) {
    env.storage().persistent().extend_ttl(
        &DataKey::Prediction(market_id, predictor.clone()),
        ttl_threshold(LEDGER_BUMP_MARKET),
        LEDGER_BUMP_MARKET,
    );
}

pub fn shorten_prediction_ttl_after_claim(env: &Env, market_id: u64, predictor: &Address) {
    env.storage().temporary().extend_ttl(
        &DataKey::Prediction(market_id, predictor.clone()),
        ttl_threshold(LEDGER_BUMP_PREDICTION_CLAIMED),
        LEDGER_BUMP_PREDICTION_CLAIMED,
    );
}

pub fn extend_user_ttl(env: &Env, user: &Address) {
    env.storage().persistent().extend_ttl(
        &DataKey::User(user.clone()),
        ttl_threshold(LEDGER_BUMP_USER),
        LEDGER_BUMP_USER,
    );
}

pub fn extend_invite_ttl(env: &Env, code: &Symbol) {
    env.storage().persistent().extend_ttl(
        &DataKey::InviteCode(code.clone()),
        ttl_threshold(LEDGER_BUMP_INVITE),
        LEDGER_BUMP_INVITE,
    );
}

pub fn extend_config_ttl(env: &Env) {
    env.storage().persistent().extend_ttl(
        &DataKey::Config,
        ttl_threshold(LEDGER_BUMP_PERMANENT),
        LEDGER_BUMP_PERMANENT,
    );
}

pub fn extend_season_ttl(env: &Env, season_id: u32) {
    env.storage().persistent().extend_ttl(
        &DataKey::Season(season_id),
        ttl_threshold(LEDGER_BUMP_PERMANENT),
        LEDGER_BUMP_PERMANENT,
    );

    if env
        .storage()
        .persistent()
        .has(&DataKey::Leaderboard(season_id))
    {
        env.storage().persistent().extend_ttl(
            &DataKey::Leaderboard(season_id),
            ttl_threshold(LEDGER_BUMP_PERMANENT),
            LEDGER_BUMP_PERMANENT,
        );
    }
}

// ── Config struct ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct Config {
    /// Platform administrator; the only address allowed to call mutators.
    pub admin: Address,
    /// Platform cut in basis points (e.g. 200 = 2 %).
    pub protocol_fee_bps: u32,
    /// Hard cap on the fee a market creator may charge, in basis points.
    pub max_creator_fee_bps: u32,
    /// Global per-prediction minimum stake in stroops. Markets may override
    /// this with a non-zero `Market::min_stake`; `0` on the market means
    /// "use this global floor".
    pub min_stake_xlm: i128,
    /// Global per-prediction maximum stake in stroops. Markets may override
    /// this with a non-zero `Market::max_stake`; `0` on the market means
    /// "use this global ceiling". Must always satisfy `min_stake_xlm <= max_stake_xlm`.
    pub max_stake_xlm: i128,
    /// Trusted oracle contract address used for market resolution.
    pub oracle_address: Address,
    /// Address of the XLM Stellar Asset Contract used for escrow transfers.
    pub xlm_token: Address,
    /// When `true`, all non-admin entry points must revert with `Paused`.
    /// Set via [`set_paused`]: only `guardian` may set this to `true`
    /// (pause); only `admin` may set it back to `false` (unpause).
    pub is_paused: bool,
    /// Address authorized to veto a queued governance proposal during its
    /// timelock window, and to engage the emergency pause (see
    /// [`set_paused`]). Distinct from `admin` so a single compromised role
    /// cannot both halt *and* resume the contract. Defaults to `admin` at
    /// initialization.
    pub guardian: Address,
    /// Delay (seconds) a passed governance proposal must wait in the queue
    /// before `execute_proposal` will apply it. This value — and `guardian`
    /// above — are only mutable via the admin-only setters in this module;
    /// no `ProposalType` variant may change them, so a proposal can never
    /// vote itself a shorter timelock or a friendlier guardian.
    pub timelock_delay: u64,
    /// Minimum reputation score (0-1000, see
    /// `reputation::calculate_creator_reputation`) a creator must have to
    /// create a market. Creators below this score are rejected with
    /// `InsufficientReputation` unless they are on the trusted-creator
    /// allowlist (`DataKey::TrustedCreator`). Governance-configurable via
    /// `set_min_creator_reputation` (admin, immediate) or
    /// `ProposalType::UpdateMinReputation` (timelocked governance). Defaults
    /// to `0` at initialization, which disables the gate entirely.
    pub min_creator_reputation: u32,
    /// Number of ledgers a market's persistent-storage entry is extended by
    /// on each interaction (`market::bump_market`) and by the explicit
    /// `extend_market_ttl` maintenance entrypoint. Admin-configurable via
    /// `set_market_ttl_extension`. Defaults to `LEDGER_BUMP_MARKET` (~30
    /// days) at initialization.
    pub market_ttl_extension: u32,
    /// Share (bps, 0-10000) of every slashed bond (failed dispute/appeal
    /// forfeiture) routed into the insurance pool rather than the protocol
    /// treasury. Governance-configurable via `set_insurance_pool_share_bps`.
    /// Defaults to `1000` (10%) at initialization.
    pub insurance_pool_share_bps: u32,
    /// Running balance (stroops) held in the insurance pool, funded by
    /// `insurance_pool_share_bps` of every slashed bond. Drawn down only via
    /// `escrow::draw_insurance_pool` (admin/governance-only) to cover
    /// documented accounting/settlement shortfalls.
    pub insurance_pool_balance: i128,
    /// Cumulative total (stroops) ever paid out of the insurance pool via
    /// `escrow::draw_insurance_pool`. Monotonic; never decreases.
    pub insurance_pool_payouts_total: i128,
    /// Global cap (stroops) on the liquidity any single outcome's AMM
    /// reserve may hold. `0` means unlimited. Markets may override this with
    /// a non-zero `Market::outcome_liquidity_cap`; see
    /// `liquidity::add_liquidity`. Admin-configurable via
    /// `set_max_liquidity_per_outcome`. Defaults to `0` at initialization.
    pub max_liquidity_per_outcome: i128,
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Extend the persistent TTL for the Config entry whenever it drops below
/// `PERSISTENT_THRESHOLD`. Must be called on every read *and* every write.
fn bump_config(env: &Env) {
    extend_config_ttl(env);
}

/// Load Config from persistent storage.
/// Returns `NotInitialized` if the key is absent rather than panicking.
fn load_config(env: &Env) -> Result<Config, InsightArenaError> {
    env.storage()
        .persistent()
        .get(&DataKey::Config)
        .ok_or(InsightArenaError::NotInitialized)
}

fn validate_protocol_fee(fee_bps: u32) -> Result<(), InsightArenaError> {
    if fee_bps > 10_000 {
        return Err(InsightArenaError::InvalidFee);
    }

    Ok(())
}

fn validate_min_reputation(threshold: u32) -> Result<(), InsightArenaError> {
    // Reputation scores are clamped to [0, 1000] by `calculate_creator_reputation`;
    // a higher threshold could never be met by anyone, which is almost certainly
    // a misconfiguration rather than an intentional full lockout.
    if threshold > 1000 {
        return Err(InsightArenaError::InvalidInput);
    }

    Ok(())
}

/// Validate global (or market-override) stake bounds.
///
/// Both bounds must be strictly positive and `min_stake <= max_stake`.
pub(crate) fn validate_stake_bounds(min_stake: i128, max_stake: i128) -> Result<(), InsightArenaError> {
    if min_stake <= 0 || max_stake <= 0 {
        return Err(InsightArenaError::InvalidInput);
    }
    if min_stake > max_stake {
        return Err(InsightArenaError::InvalidInput);
    }
    Ok(())
}

/// Resolve the effective `[min, max]` stake window for a market.
///
/// A non-zero market field is treated as a per-market override and takes
/// precedence over the corresponding global `Config` bound. A zero market
/// field inherits the global bound. The resolved pair is always validated.
pub fn resolve_stake_bounds(
    env: &Env,
    market_min_stake: i128,
    market_max_stake: i128,
) -> Result<(i128, i128), InsightArenaError> {
    let cfg = load_config(env)?;
    let min = if market_min_stake > 0 {
        market_min_stake
    } else {
        cfg.min_stake_xlm
    };
    let max = if market_max_stake > 0 {
        market_max_stake
    } else {
        cfg.max_stake_xlm
    };
    validate_stake_bounds(min, max)?;
    Ok((min, max))
}

// ── Entry-point logic (called from contractimpl in lib.rs) ────────────────────

/// One-time contract setup.
///
/// Stores the initial [`Config`] and returns `AlreadyInitialized` on any
/// subsequent call, providing an idempotency guard.
pub fn initialize(
    env: &Env,
    admin: Address,
    oracle: Address,
    fee_bps: u32,
    xlm_token: Address,
) -> Result<(), InsightArenaError> {
    if env.storage().persistent().has(&DataKey::Config) {
        return Err(InsightArenaError::AlreadyInitialized);
    }

    validate_protocol_fee(fee_bps)?;

    let config = Config {
        guardian: admin.clone(),
        admin,
        protocol_fee_bps: fee_bps,
        max_creator_fee_bps: 500,  // 5 % absolute cap for market creators
        min_stake_xlm: 10_000_000, // 1 XLM expressed in stroops
        max_stake_xlm: 1_000_000_000_000, // 100_000 XLM expressed in stroops
        oracle_address: oracle,
        xlm_token,
        is_paused: false,
        timelock_delay: DEFAULT_TIMELOCK_DELAY,
        min_creator_reputation: 0, // gate disabled by default; admin/governance opt in
        market_ttl_extension: LEDGER_BUMP_MARKET,
        insurance_pool_share_bps: 1000, // 10% of every slashed bond reserved by default
        insurance_pool_balance: 0,
        insurance_pool_payouts_total: 0,
        max_liquidity_per_outcome: 0, // unlimited until admin configures a cap
    };

    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);
    env.storage()
        .instance()
        .set(&DataKey::Categories, &default_categories(env));
    env.storage()
        .instance()
        .extend_ttl(PERSISTENT_THRESHOLD, PERSISTENT_BUMP);

    Ok(())
}

pub(crate) fn default_categories(env: &Env) -> Vec<Symbol> {
    let mut categories = Vec::new(env);
    categories.push_back(Symbol::new(env, "Sports"));
    categories.push_back(Symbol::new(env, "Crypto"));
    categories.push_back(Symbol::new(env, "Politics"));
    categories.push_back(Symbol::new(env, "Entertainment"));
    categories.push_back(Symbol::new(env, "Science"));
    categories.push_back(Symbol::new(env, "Other"));
    categories
}

/// Return the current global [`Config`] and extend its TTL.
pub fn get_config(env: &Env) -> Result<Config, InsightArenaError> {
    let config = load_config(env)?;
    bump_config(env);
    Ok(config)
}

/// Return the current global [`Config`] without mutating storage.
///
/// This helper is intended for strict view functions that must avoid any state
/// writes, including TTL extension side-effects.
pub fn get_config_readonly(env: &Env) -> Result<Config, InsightArenaError> {
    load_config(env)
}

/// Update the protocol fee rate. Caller must be the stored admin.
pub fn update_protocol_fee(env: &Env, new_fee_bps: u32) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    // Authorisation check — reverts the entire transaction if auth is absent.
    config.admin.require_auth();

    validate_protocol_fee(new_fee_bps)?;

    config.protocol_fee_bps = new_fee_bps;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    Ok(())
}

pub fn update_protocol_fee_from_governance(
    env: &Env,
    new_fee_bps: u32,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;
    validate_protocol_fee(new_fee_bps)?;
    config.protocol_fee_bps = new_fee_bps;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);
    Ok(())
}

/// Engage or lift the emergency pause, enforcing strict separation of duties:
///
/// - Pausing (`paused == true`) may only be authorized by the stored
///   **guardian**. The guardian is a distinct, lower-trust role intended to
///   react quickly to a discovered exploit without needing full admin
///   authority.
/// - Unpausing (`paused == false`) may only be authorized by the stored
///   **admin**. This ensures a single compromised or malicious guardian can
///   halt the contract but can never be the one to resume it — resuming
///   operation after an incident requires the higher-trust admin role.
///
/// While `paused` is `true`, all fund-moving and other sensitive entry points
/// call [`ensure_not_paused`] (or, for the escrow primitives, check it
/// directly) and revert with [`InsightArenaError::Paused`].
///
/// `reason_code` is an opaque, caller-defined code (e.g. 1 = incident,
/// 2 = scheduled maintenance, 0 = resume/no reason) recorded on the emitted
/// event for off-chain auditing. It is not validated or persisted.
///
/// # Errors
/// - `Unauthorized` is not returned directly here; instead `require_auth`
///   panics (reverting the transaction) when the wrong role signs the call,
///   consistent with every other role-gated setter in this module.
pub fn set_paused(env: &Env, paused: bool, reason_code: u32) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    // Separation of duties: the guardian engages the pause, only the admin
    // may lift it. Branching on `paused` (rather than exposing two entry
    // points) keeps the public ABI unchanged while still requiring the
    // correct, distinct role for each direction.
    let actor = if paused {
        config.guardian.require_auth();
        config.guardian.clone()
    } else {
        config.admin.require_auth();
        config.admin.clone()
    };

    config.is_paused = paused;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_paused_toggled(env, &actor, paused, reason_code);

    Ok(())
}

fn emit_paused_toggled(env: &Env, actor: &Address, paused: bool, reason_code: u32) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("paused")),
        (actor.clone(), paused, reason_code),
    );
}

pub fn transfer_admin(env: &Env, new_admin: Address) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    // Auth against the *current* admin before overwriting.
    config.admin.require_auth();

    config.admin = new_admin;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    Ok(())
}

/// Update the trusted oracle address. Caller must be the current admin.
///
/// After this call the old oracle address can no longer resolve markets.
pub fn update_oracle(
    env: &Env,
    admin: Address,
    new_oracle: Address,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    // Auth against the *current* admin.
    admin.require_auth();

    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    let old_oracle = config.oracle_address;
    config.oracle_address = new_oracle.clone();
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_oracle_updated(env, &old_oracle, &new_oracle);

    Ok(())
}

fn emit_oracle_updated(env: &Env, old_oracle: &Address, new_oracle: &Address) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("ora_upd")),
        (old_oracle.clone(), new_oracle.clone()),
    );
}

/// Update the governance timelock delay. Caller must be the stored admin.
///
/// This is intentionally only reachable through the admin path — no
/// `ProposalType` exists to change it via governance — so a proposal can
/// never shorten its own timelock to bypass the veto window.
pub fn set_timelock_delay(
    env: &Env,
    admin: Address,
    new_delay: u64,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    let old_delay = config.timelock_delay;
    config.timelock_delay = new_delay;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_timelock_delay_updated(env, old_delay, new_delay);

    Ok(())
}

fn emit_timelock_delay_updated(env: &Env, old_delay: u64, new_delay: u64) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("tl_upd")),
        (old_delay, new_delay),
    );
}

/// Update the governance guardian address. Caller must be the stored admin.
///
/// Like `timelock_delay`, this is only reachable through the admin path —
/// no `ProposalType` exists to change it via governance — so a proposal can
/// never appoint a friendly guardian to neutralize the veto safeguard.
pub fn set_guardian(
    env: &Env,
    admin: Address,
    new_guardian: Address,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    let old_guardian = config.guardian;
    config.guardian = new_guardian.clone();
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_guardian_updated(env, &old_guardian, &new_guardian);

    Ok(())
}

fn emit_guardian_updated(env: &Env, old_guardian: &Address, new_guardian: &Address) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("grd_upd")),
        (old_guardian.clone(), new_guardian.clone()),
    );
}

/// Update the minimum creator reputation required to create a market.
/// Caller must be the stored admin. For the timelocked governance path see
/// [`update_min_reputation_from_governance`], invoked via
/// `ProposalType::UpdateMinReputation`.
pub fn set_min_creator_reputation(
    env: &Env,
    admin: Address,
    new_threshold: u32,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    validate_min_reputation(new_threshold)?;

    let old_threshold = config.min_creator_reputation;
    config.min_creator_reputation = new_threshold;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_min_reputation_updated(env, old_threshold, new_threshold);

    Ok(())
}

/// Governance path for updating the minimum reputation threshold. Called only
/// from `governance::execute_proposal` after a `ProposalType::UpdateMinReputation`
/// proposal has cleared quorum, majority, and the timelock window.
pub fn update_min_reputation_from_governance(
    env: &Env,
    new_threshold: u32,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;
    validate_min_reputation(new_threshold)?;

    let old_threshold = config.min_creator_reputation;
    config.min_creator_reputation = new_threshold;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_min_reputation_updated(env, old_threshold, new_threshold);

    Ok(())
}

fn emit_min_reputation_updated(env: &Env, old_threshold: u32, new_threshold: u32) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("rep_upd")),
        (old_threshold, new_threshold),
    );
}

/// Update the number of ledgers a market's TTL is extended by, both on each
/// interaction and via the explicit `extend_market_ttl` maintenance
/// entrypoint. Caller must be the stored admin.
pub fn set_market_ttl_extension(
    env: &Env,
    admin: Address,
    new_extension: u32,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    if new_extension == 0 {
        return Err(InsightArenaError::InvalidInput);
    }

    let old_extension = config.market_ttl_extension;
    config.market_ttl_extension = new_extension;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_market_ttl_extension_updated(env, old_extension, new_extension);

    Ok(())
}

fn emit_market_ttl_extension_updated(env: &Env, old_extension: u32, new_extension: u32) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("ttl_upd")),
        (old_extension, new_extension),
    );
}

/// Update the global per-prediction min/max stake bounds.
///
/// Caller must be the stored admin. Reverts with [`InsightArenaError::InvalidInput`]
/// when either bound is non-positive or when `min_stake > max_stake`.
pub fn set_stake_bounds(
    env: &Env,
    admin: Address,
    min_stake: i128,
    max_stake: i128,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    validate_stake_bounds(min_stake, max_stake)?;

    let old_min = config.min_stake_xlm;
    let old_max = config.max_stake_xlm;
    config.min_stake_xlm = min_stake;
    config.max_stake_xlm = max_stake;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_stake_bounds_updated(env, old_min, old_max, min_stake, max_stake);

    Ok(())
}

/// Governance path for updating the global minimum stake. Keeps the existing
/// `max_stake_xlm` and rejects the update when the new minimum would exceed it.
pub fn update_min_stake_from_governance(
    env: &Env,
    new_min_stake: i128,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;
    validate_stake_bounds(new_min_stake, config.max_stake_xlm)?;

    let old_min = config.min_stake_xlm;
    let old_max = config.max_stake_xlm;
    config.min_stake_xlm = new_min_stake;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_stake_bounds_updated(env, old_min, old_max, new_min_stake, old_max);

    Ok(())
}

fn emit_stake_bounds_updated(
    env: &Env,
    old_min: i128,
    old_max: i128,
    new_min: i128,
    new_max: i128,
) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("stk_bnd")),
        (old_min, old_max, new_min, new_max),
    );
}

/// Update the share (bps) of every slashed bond routed into the insurance
/// pool. Caller must be the stored admin.
pub fn set_insurance_pool_share_bps(
    env: &Env,
    admin: Address,
    new_share_bps: u32,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    if new_share_bps > 10_000 {
        return Err(InsightArenaError::InvalidFee);
    }

    let old_share_bps = config.insurance_pool_share_bps;
    config.insurance_pool_share_bps = new_share_bps;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_insurance_pool_share_updated(env, old_share_bps, new_share_bps);

    Ok(())
}

fn emit_insurance_pool_share_updated(env: &Env, old_share_bps: u32, new_share_bps: u32) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("ins_upd")),
        (old_share_bps, new_share_bps),
    );
}

/// Update the global maximum liquidity a single outcome's AMM reserve may
/// hold. `0` means unlimited. Caller must be the stored admin. See
/// `market::set_market_liquidity_cap` for the per-market override.
pub fn set_max_liquidity_per_outcome(
    env: &Env,
    admin: Address,
    new_cap: i128,
) -> Result<(), InsightArenaError> {
    let mut config = load_config(env)?;

    admin.require_auth();
    if admin != config.admin {
        return Err(InsightArenaError::Unauthorized);
    }

    if new_cap < 0 {
        return Err(InsightArenaError::InvalidInput);
    }

    let old_cap = config.max_liquidity_per_outcome;
    config.max_liquidity_per_outcome = new_cap;
    env.storage().persistent().set(&DataKey::Config, &config);
    bump_config(env);

    emit_max_liquidity_per_outcome_updated(env, old_cap, new_cap);

    Ok(())
}

fn emit_max_liquidity_per_outcome_updated(env: &Env, old_cap: i128, new_cap: i128) {
    env.events().publish(
        (symbol_short!("cfg"), symbol_short!("liq_cap")),
        (old_cap, new_cap),
    );
}

/// Guard used at the top of every user-facing entry point.
///
/// Visibility is `pub(crate)` — this function is intentionally **not** part of
/// the public contract ABI; it is an internal safety check only.
///
/// Behaviour:
/// - Returns `Err(NotInitialized)` if the contract has not been set up yet.
/// - Returns `Err(Paused)` while `config.is_paused == true`.
/// - Returns `Ok(())` otherwise, extending the Config TTL as a side-effect.
pub(crate) fn ensure_not_paused(env: &Env) -> Result<(), InsightArenaError> {
    let config = load_config(env)?;
    bump_config(env);
    if config.is_paused {
        return Err(InsightArenaError::Paused);
    }
    Ok(())
}
