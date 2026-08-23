//! Event topic helpers.
//!
//! The off-chain indexer subscribes to these. Keep topic names stable.
//!
//! TODO(issue): implement typed publishers for each event, e.g.
//!   deposit(owner, amount), withdraw(owner, amount),
//!   locked_created(id, owner, unlock_at), goal_reached(id, owner),
//!   group_created(id, creator), group_split_settled(id).
