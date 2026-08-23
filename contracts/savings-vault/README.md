# savings-vault

Non-custodial savings vault for **Stow**, on Stellar/Soroban (Rust, `soroban-sdk` 22).

This crate is a **skeleton**. Every entrypoint is stubbed with `unimplemented!()`
and a `TODO(issue)` comment describing intended behavior and acceptance criteria.
Each stub is designed to become one GitHub issue.

## Module → issue map

| Module | Entrypoints | Suggested issues |
| --- | --- | --- |
| `admin` | `initialize`, `token`, `set_admin` | init guard, token config, admin rotation |
| `storage` | TTL + accessors | storage helpers, TTL tuning, id allocation |
| `flexible` | `deposit`, `withdraw`, `get_account` | one issue each |
| `locked` | `create`, `top_up`, `withdraw`, `plan` | create + time-lock enforcement, top-up, withdraw |
| `goal` | `create`, `contribute`, `claim`, `goal` | create, contribute + milestone, claim |
| `group` | `create`, `join`, `contribute`, `close`, `payout_equal` | one issue each |
| `group_split` | `set_shares`, `settle` | shares validation, weighted settlement |
| `events` | typed publishers | one issue per event topic |
| `test` | integration tests | one issue per `#[ignore]`d test |

## Layout

```text
src/
  lib.rs         # contract + entrypoints (delegates to modules)
  types.rs       # data structures + DataKey storage keys
  storage.rs     # storage/TTL helpers
  admin.rs       # init + admin
  flexible.rs    # flexible savings
  locked.rs      # locked savings
  goal.rs        # goal-based savings
  group.rs       # group pools
  group_split.rs # weighted group settlement
  events.rs      # event topics
  test.rs        # test skeleton
```

## Build & test

```bash
cargo build --target wasm32-unknown-unknown --release
cargo test           # placeholder tests are #[ignore]d until implemented
```

> Note: entrypoints currently `unimplemented!()` — they compile but panic at
> runtime until a contributor implements them.
