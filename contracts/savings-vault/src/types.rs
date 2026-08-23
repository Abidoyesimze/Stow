use soroban_sdk::{contracttype, Address, Map, String, Vec};

/// A flexible savings account: deposit and withdraw any time.
#[contracttype]
#[derive(Clone)]
pub struct FlexibleAccount {
    pub owner: Address,
    /// Current balance held for this owner, in token stroops.
    pub balance: i128,
    pub created_at: u64,
    pub updated_at: u64,
}

/// A locked savings plan: funds cannot be withdrawn until `unlock_at`.
#[contracttype]
#[derive(Clone)]
pub struct LockedPlan {
    pub id: u64,
    pub owner: Address,
    pub balance: i128,
    /// Ledger timestamp after which withdrawal is permitted.
    pub unlock_at: u64,
    pub created_at: u64,
}

/// A goal-based savings target with automated milestone tracking.
#[contracttype]
#[derive(Clone)]
pub struct Goal {
    pub id: u64,
    pub owner: Address,
    pub name: String,
    pub target_amount: i128,
    pub saved_amount: i128,
    pub created_at: u64,
    /// Set when `saved_amount >= target_amount`.
    pub reached_at: Option<u64>,
}

/// A group savings pool with shared rules and contract-enforced payouts.
#[contracttype]
#[derive(Clone)]
pub struct Group {
    pub id: u64,
    pub creator: Address,
    pub name: String,
    pub members: Vec<Address>,
    /// Total pooled balance.
    pub balance: i128,
    /// Per-member split in basis points (must sum to 10_000) for group-split payout.
    /// Empty for equal-split groups.
    pub shares_bps: Map<Address, u32>,
    pub open: bool,
    pub created_at: u64,
}

/// Storage keys. One variant per logical record family.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Global config / initialization guard.
    Config,
    /// The SEP-41 token (e.g. USDC) this vault holds.
    Token,
    /// Contract admin.
    Admin,
    /// Monotonic counters for plan/goal/group ids.
    NextLockedId,
    NextGoalId,
    NextGroupId,
    /// FlexibleAccount by owner.
    Flexible(Address),
    /// LockedPlan by id.
    Locked(u64),
    /// Goal by id.
    Goal(u64),
    /// Group by id.
    Group(u64),
}
