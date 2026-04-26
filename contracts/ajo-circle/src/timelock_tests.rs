#![cfg(test)]

use crate::{AjoCircle, AjoCircleClient, AjoError, DataKey, TimelockProposal, UPGRADE_TIMELOCK_SECONDS};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, BytesN, Env,
};

fn base_ledger() -> LedgerInfo {
    LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 20,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3_110_400,
    }
}

fn setup(env: &Env) -> (AjoCircleClient, Address) {
    env.ledger().set(base_ledger());
    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let organizer = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(organizer.clone());

    client.initialize_circle(&organizer, &token_address, &1_000_000_i128, &7_u32, &2_u32, &0_u32);
    (client, organizer)
}

fn dummy_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

// ── propose_upgrade ───────────────────────────────────────────────────────────

#[test]
fn propose_upgrade_stores_proposal_and_returns_unlock_time() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    let unlock_time = client.propose_upgrade(&organizer, &dummy_hash(&env)).unwrap();
    assert_eq!(unlock_time, 1_000_000 + UPGRADE_TIMELOCK_SECONDS);

    let proposal: TimelockProposal = env
        .storage()
        .instance()
        .get(&DataKey::PendingUpgrade)
        .unwrap();
    assert_eq!(proposal.unlock_time, unlock_time);
    assert_eq!(proposal.new_wasm_hash, dummy_hash(&env));
}

#[test]
fn propose_upgrade_rejects_non_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let stranger = Address::generate(&env);
    assert_eq!(
        client.propose_upgrade(&stranger, &dummy_hash(&env)),
        Err(AjoError::Unauthorized)
    );
}

// ── execute_upgrade ───────────────────────────────────────────────────────────

#[test]
fn execute_upgrade_fails_before_timelock_expires() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    client.propose_upgrade(&organizer, &dummy_hash(&env)).unwrap();

    // Advance time by less than 48 hours
    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + UPGRADE_TIMELOCK_SECONDS - 1,
        ..base_ledger()
    });

    assert_eq!(
        client.execute_upgrade(&organizer),
        Err(AjoError::TimelockNotReady)
    );
}

#[test]
fn execute_upgrade_fails_with_no_pending_proposal() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    assert_eq!(client.execute_upgrade(&organizer), Err(AjoError::NotFound));
}

#[test]
fn execute_upgrade_rejects_non_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    client.propose_upgrade(&organizer, &dummy_hash(&env)).unwrap();

    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + UPGRADE_TIMELOCK_SECONDS,
        ..base_ledger()
    });

    let stranger = Address::generate(&env);
    assert_eq!(
        client.execute_upgrade(&stranger),
        Err(AjoError::Unauthorized)
    );
}

#[test]
fn execute_upgrade_clears_proposal_after_execution() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    client.propose_upgrade(&organizer, &dummy_hash(&env)).unwrap();

    env.ledger().set(LedgerInfo {
        timestamp: 1_000_000 + UPGRADE_TIMELOCK_SECONDS,
        ..base_ledger()
    });

    // execute_upgrade will panic inside update_current_contract_wasm with a dummy hash,
    // so we only verify the proposal is removed before the wasm call by checking
    // that a second execute attempt returns NotFound (not TimelockNotReady).
    // In a real environment with a valid hash this would succeed.
    let _ = client.execute_upgrade(&organizer); // may error on wasm apply

    let has_proposal: bool = env
        .storage()
        .instance()
        .has(&DataKey::PendingUpgrade);
    assert!(!has_proposal, "PendingUpgrade must be cleared after execution attempt");
}

#[test]
fn propose_upgrade_overwrites_existing_proposal() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, organizer) = setup(&env);

    let hash_a = BytesN::from_array(&env, &[1u8; 32]);
    let hash_b = BytesN::from_array(&env, &[2u8; 32]);

    client.propose_upgrade(&organizer, &hash_a).unwrap();

    // Advance time slightly and propose again
    env.ledger().set(LedgerInfo {
        timestamp: 1_000_100,
        ..base_ledger()
    });
    client.propose_upgrade(&organizer, &hash_b).unwrap();

    let proposal: TimelockProposal = env
        .storage()
        .instance()
        .get(&DataKey::PendingUpgrade)
        .unwrap();
    assert_eq!(proposal.new_wasm_hash, hash_b);
    assert_eq!(proposal.unlock_time, 1_000_100 + UPGRADE_TIMELOCK_SECONDS);
}
