#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger}, token::{StellarAssetClient}, Address, Env, Symbol,
};
use ajo_circle::{AjoCircle, AjoError, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, MIN_ROUNDS, MAX_ROUNDS};

// Role symbols
const ADMIN_ROLE: Symbol = Symbol::short("ADMIN");
const MANAGER_ROLE: Symbol = Symbol::short("MANAGER");
const INVALID_ROLE: Symbol = Symbol::short("INVALID");

/// Fuzz input structure for role management
#[derive(Debug, arbitrary::Arbitrary)]
struct RoleInput {
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
    role_selector: u8, // 0=ADMIN, 1=MANAGER, 2=INVALID, 3+ edge cases
    fuzz_seed: u64,
}

fuzz_target!(|input: RoleInput| {
    let env = Env::default();
    env.mock_all_auths();

    let organizer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = StellarAssetClient::new(&env, &token_admin);
    let token_address = token.address();

    // Set ledger info
    env.ledger().set_timestamp(1000000);

    // Initialize circle
    let init_result = AjoCircle::initialize_circle(
        env.clone(),
        organizer.clone(),
        token_address.clone(),
        input.contribution_amount,
        input.frequency_days,
        input.max_rounds,
        input.max_members,
    );

    if init_result.is_err() {
        return;
    }

    // Select role based on fuzz input
    let role = match input.role_selector % 4 {
        0 => ADMIN_ROLE,
        1 => MANAGER_ROLE,
        2 => INVALID_ROLE,
        _ => Symbol::new(&env, &format!("ROLE{}", input.fuzz_seed)),
    };

    let new_member = Address::generate(&env);

    // Test grant_role with fuzzed role
    let grant_result = AjoCircle::grant_role(
        env.clone(),
        organizer.clone(),
        role.clone(),
        new_member.clone(),
    );

    match grant_result {
        Ok(()) => {
            // Role granted successfully
            assert!(
                role == ADMIN_ROLE || role == MANAGER_ROLE,
                "Only ADMIN or MANAGER roles should be grantable"
            );
        }
        Err(AjoError::InvalidInput) => {
            // Expected for invalid roles
            assert!(
                role != ADMIN_ROLE && role != MANAGER_ROLE,
                "InvalidInput should occur for non-ADMIN/MANAGER roles"
            );
        }
        Err(AjoError::AlreadyExists) => {
            // Member already has this role
        }
        Err(AjoError::Unauthorized) => {
            // Caller not deployer
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Test has_role query
    let has_role = AjoCircle::has_role(env.clone(), role.clone(), new_member.clone());
    // Query should always succeed without error

    // Test revoke_role
    let revoke_result = AjoCircle::revoke_role(
        env.clone(),
        organizer.clone(),
        role.clone(),
        new_member.clone(),
    );

    match revoke_result {
        Ok(()) => {
            // Role revoked successfully
        }
        Err(AjoError::InvalidInput) => {
            // Invalid role
        }
        Err(AjoError::NotFound) => {
            // Member doesn't have this role
        }
        Err(AjoError::Unauthorized) => {
            // Cannot revoke deployer's ADMIN role or caller not deployer
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Test get_deployer
    let deployer_result = AjoCircle::get_deployer(env.clone());
    match deployer_result {
        Ok(deployer) => {
            assert_eq!(deployer, organizer, "Deployer should match organizer");
        }
        Err(_) => {
            // Should not happen after successful init
        }
    }

    // Test get_member_balance query (should never panic)
    let balance_result = AjoCircle::get_member_balance(env.clone(), new_member.clone());
    match balance_result {
        Ok(_) | Err(_) => {
            // Both results acceptable - query should not panic
        }
    }

    // Test with organizer address
    let org_balance = AjoCircle::get_member_balance(env.clone(), organizer.clone());
    match org_balance {
        Ok(data) => {
            // Organizer should exist
            assert_eq!(data.address, organizer);
        }
        Err(_) => {}
    }
});
