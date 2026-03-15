/// Oni Games — Casino (GambleFi Engine) Smart Contract
/// 
/// This contract handles ALL casino games through two abstract flow categories:
/// 
/// Category A: Instant Play (Player vs. On-Chain RNG)
///   - Coin Flip, Dice Roll, Roulette, Wheel of Fortune
///   - Uses OneChain's native `one::random` module
///   - `entry` function (prevents PTB rollback exploits)
/// 
/// Category B: Session / Escrow Play (State & Streaks)
///   - Crypto Crash, Minesweeper, High-Low
///   - Two-step flow: lock_wager → resolve_session (with server signature)
///   - Backend calculates multiplier, signs with Ed25519
/// 
/// Future-proof: Adding a new game NEVER requires redeploying this contract.
#[allow(lint(self_transfer, coin_field), unused_const)]
module oni_games::casino;

use one::coin::{Self, Coin};
use one::oct::OCT;
use one::balance::{Self, Balance};
use one::table::{Self, Table};
use one::event;
use one::ed25519;
use one::bcs;
use one::random::{Self, Random};
use std::string::String;

// ============= Error Codes =============
const E_NOT_ADMIN: u64 = 1;
const E_INSUFFICIENT_BANKROLL: u64 = 2;
const E_INVALID_BET: u64 = 3;
const E_BET_TOO_SMALL: u64 = 4;
const E_BET_TOO_LARGE: u64 = 5;
const E_INVALID_RANGE: u64 = 6;
const E_INVALID_MULTIPLIER: u64 = 7;
const E_INVALID_SIGNATURE: u64 = 8;
const E_SERVER_KEY_NOT_SET: u64 = 9;
const E_NOT_SESSION_OWNER: u64 = 10;
const E_PAYOUT_EXCEEDS_MAX: u64 = 11;
const E_INVALID_FEE_BPS: u64 = 12;
const E_NONCE_ALREADY_USED: u64 = 13;
const E_CASINO_PAUSED: u64 = 14;
const E_INVALID_GUESS: u64 = 15;

// ============= Constants =============
/// Maximum basis points (100% = 10_000 BPS)
const MAX_BPS: u64 = 10_000;

// ============= Structs =============

/// One-time admin capability object, created on module init.
/// Only the deployer holds this.
public struct CasinoAdminCap has key {
    id: UID,
}

/// Shared global house bankroll and configuration.
/// Holds the OCT liquidity pool, server key, fees, and stats.
public struct HouseBankroll has key {
    id: UID,
    /// House liquidity pool (all wagers and payouts flow through here)
    balance: Balance<OCT>,
    /// Treasury address where house edge fees are sent
    treasury: address,
    /// Server's ed25519 public key (32 bytes) for verifying session resolutions
    server_public_key: vector<u8>,
    /// House edge in basis points (e.g., 250 = 2.5%). Informational/tracked.
    house_edge_bps: u64,
    /// Minimum wager in MIST
    min_bet: u64,
    /// Maximum wager in MIST
    max_bet: u64,
    /// Max payout as basis points of bankroll (e.g., 500 = 5%)
    max_payout_bps: u64,
    /// Lifetime total wagers (in MIST)
    total_wagers: u64,
    /// Lifetime total payouts (in MIST)
    total_payouts: u64,
    /// Lifetime total games played
    total_games: u64,
    /// Used nonces to prevent replay attacks on session resolution
    used_nonces: Table<u64, bool>,
    /// Emergency pause switch
    paused: bool,
}

/// An active game session (escrow) for Category B games.
/// Created by lock_wager, consumed by resolve_session.
/// The wager is held inside this object until resolution.
public struct ActiveSession has key, store {
    id: UID,
    /// Player who locked the wager
    player: address,
    /// Game identifier (e.g., "crash", "minesweeper")
    game_id: String,
    /// The escrowed wager coin
    wager: Coin<OCT>,
    /// Cached wager amount for easy access
    wager_amount: u64,
    /// Epoch timestamp (ms) when the session was created
    created_at: u64,
}

// ============= Events =============

/// Emitted when an instant wager game is played and resolved.
public struct InstantWagerPlayed has copy, drop {
    player: address,
    game_id: String,
    wager_amount: u64,
    guess: u64,
    result: u64,
    won: bool,
    payout: u64,
    multiplier_bps: u64,
}

/// Emitted when a session (escrow) is created.
public struct SessionCreated has copy, drop {
    session_id: ID,
    player: address,
    game_id: String,
    wager_amount: u64,
}

/// Emitted when a session is resolved (won or lost).
public struct SessionResolved has copy, drop {
    session_id: ID,
    player: address,
    game_id: String,
    wager_amount: u64,
    multiplier_bps: u64,
    payout: u64,
    won: bool,
}

/// Emitted when bankroll is funded.
public struct BankrollFunded has copy, drop {
    funder: address,
    amount: u64,
    new_total: u64,
}

/// Emitted when bankroll liquidity is withdrawn.
public struct BankrollWithdrawn has copy, drop {
    amount: u64,
    new_total: u64,
}

// ============= Module Init =============

/// Called once when the module is published.
/// Creates CasinoAdminCap for deployer and shared HouseBankroll.
fun init(ctx: &mut TxContext) {
    // Create admin capability and transfer to deployer
    let admin_cap = CasinoAdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());

    // Create shared house bankroll
    let bankroll = HouseBankroll {
        id: object::new(ctx),
        balance: balance::zero<OCT>(),
        treasury: ctx.sender(),
        server_public_key: vector::empty<u8>(),
        house_edge_bps: 250,         // 2.5% default house edge
        min_bet: 10_000_000,         // 0.01 OCT default min bet
        max_bet: 10_000_000_000,     // 10 OCT default max bet
        max_payout_bps: 500,         // Max 5% of bankroll per payout
        total_wagers: 0,
        total_payouts: 0,
        total_games: 0,
        used_nonces: table::new(ctx),
        paused: false,
    };
    transfer::share_object(bankroll);
}

// ============= Admin Functions =============

/// Set the server's ed25519 public key for session signature verification.
/// Must be called once after deploy before `resolve_session` can be used.
public fun set_server_public_key(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    public_key: vector<u8>,
) {
    bankroll.server_public_key = public_key;
}

/// Set the house edge in basis points (informational, tracked in events).
public fun set_house_edge_bps(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    bps: u64,
) {
    assert!(bps <= MAX_BPS, E_INVALID_FEE_BPS);
    bankroll.house_edge_bps = bps;
}

/// Set minimum and maximum bet limits.
public fun set_bet_limits(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    min_bet: u64,
    max_bet: u64,
) {
    assert!(min_bet > 0, E_INVALID_BET);
    assert!(max_bet >= min_bet, E_INVALID_BET);
    bankroll.min_bet = min_bet;
    bankroll.max_bet = max_bet;
}

/// Set the max payout as basis points of bankroll.
public fun set_max_payout_bps(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    bps: u64,
) {
    assert!(bps > 0 && bps <= MAX_BPS, E_INVALID_FEE_BPS);
    bankroll.max_payout_bps = bps;
}

/// Set the treasury address.
public fun set_treasury(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    new_treasury: address,
) {
    bankroll.treasury = new_treasury;
}

/// Emergency pause/unpause the casino.
public fun set_paused(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    paused: bool,
) {
    bankroll.paused = paused;
}

/// Fund the house bankroll with OCT liquidity.
/// Anyone can fund (but typically the admin/house).
public fun fund_bankroll(
    bankroll: &mut HouseBankroll,
    coin: Coin<OCT>,
    ctx: &TxContext,
) {
    let amount = coin::value(&coin);
    balance::join(&mut bankroll.balance, coin::into_balance(coin));

    event::emit(BankrollFunded {
        funder: ctx.sender(),
        amount,
        new_total: balance::value(&bankroll.balance),
    });
}

/// Withdraw OCT liquidity from the bankroll. Admin only.
public fun withdraw_bankroll(
    _admin: &CasinoAdminCap,
    bankroll: &mut HouseBankroll,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(balance::value(&bankroll.balance) >= amount, E_INSUFFICIENT_BANKROLL);

    let withdrawn = coin::take(&mut bankroll.balance, amount, ctx);
    transfer::public_transfer(withdrawn, bankroll.treasury);

    event::emit(BankrollWithdrawn {
        amount,
        new_total: balance::value(&bankroll.balance),
    });
}

// ============= Category A: Instant Play =============
// 
// For games resolved entirely on-chain with RNG:
// Coin Flip, Dice Roll, Roulette, Wheel of Fortune, etc.
//
// IMPORTANT: This is an `entry` function (not `public`) to prevent
// Programmable Transaction Block (PTB) composition. Without this,
// a player could compose a PTB that calls play_instant_wager and
// then inspects the result — rolling back the transaction if they lose.

/// Play an instant wager game. The contract generates a random number
/// in [0, game_range) and checks if it matches the player's guess.
///
/// Parameters:
/// - `wager`: The OCT coin being wagered
/// - `game_id`: Game identifier string (e.g., "coin_flip", "dice", "roulette")
/// - `guess`: Player's guess/bet (must be in [0, game_range))
/// - `game_range`: Total number of outcomes (e.g., 2 for coin flip, 37 for roulette)
/// - `multiplier_bps`: Payout multiplier in basis points (e.g., 19600 = 1.96x)
///
/// If the random result == guess, player wins: wager * multiplier_bps / 10_000.
/// If the random result != guess, player loses: wager goes to house.
entry fun play_instant_wager(
    bankroll: &mut HouseBankroll,
    rng: &Random,
    wager: Coin<OCT>,
    game_id: String,
    guess: u64,
    game_range: u64,
    multiplier_bps: u64,
    ctx: &mut TxContext,
) {
    // Safety checks
    assert!(!bankroll.paused, E_CASINO_PAUSED);
    assert!(game_range >= 2, E_INVALID_RANGE);
    assert!(guess < game_range, E_INVALID_GUESS);
    assert!(multiplier_bps > 0, E_INVALID_MULTIPLIER);

    let player = ctx.sender();
    let wager_amount = coin::value(&wager);

    // Validate bet size
    assert!(wager_amount >= bankroll.min_bet, E_BET_TOO_SMALL);
    assert!(wager_amount <= bankroll.max_bet, E_BET_TOO_LARGE);

    // Calculate potential payout and verify bankroll can cover it
    let potential_payout = (wager_amount * multiplier_bps) / MAX_BPS;
    let max_allowed_payout = (balance::value(&bankroll.balance) * bankroll.max_payout_bps) / MAX_BPS;
    assert!(potential_payout <= max_allowed_payout + wager_amount, E_PAYOUT_EXCEEDS_MAX);

    // Generate random number using OneChain's native RNG
    let mut generator = random::new_generator(rng, ctx);
    let result = random::generate_u64_in_range(&mut generator, 0, game_range - 1);

    let won = (result == guess);

    if (won) {
        // Player wins! Deposit wager to bankroll, then pay out total payout
        balance::join(&mut bankroll.balance, coin::into_balance(wager));

        // Payout = wager * multiplier / 10_000
        let payout_coin = coin::take(&mut bankroll.balance, potential_payout, ctx);
        transfer::public_transfer(payout_coin, player);

        // Update stats
        bankroll.total_payouts = bankroll.total_payouts + potential_payout;

        // Emit event
        event::emit(InstantWagerPlayed {
            player,
            game_id,
            wager_amount,
            guess,
            result,
            won: true,
            payout: potential_payout,
            multiplier_bps,
        });
    } else {
        // Player loses — wager goes to house
        balance::join(&mut bankroll.balance, coin::into_balance(wager));

        // Emit event
        event::emit(InstantWagerPlayed {
            player,
            game_id,
            wager_amount,
            guess,
            result,
            won: false,
            payout: 0,
            multiplier_bps,
        });
    };

    // Update lifetime stats
    bankroll.total_wagers = bankroll.total_wagers + wager_amount;
    bankroll.total_games = bankroll.total_games + 1;
}

// ============= Category B: Session / Escrow Play =============
//
// For games with state, streaks, or multi-round gameplay:
// Crypto Crash, Minesweeper, High-Low, Blackjack, etc.
//
// Flow:
// 1. Player calls lock_wager → creates ActiveSession (escrow)
// 2. Player plays the game off-chain (Next.js frontend)
// 3. Backend calculates final multiplier and signs it
// 4. Admin/Player calls resolve_session with the signature
// 5. Contract verifies, pays out or sweeps wager

/// Step 1: Lock a wager to start a session-based game.
/// Creates an ActiveSession object holding the escrowed coin.
/// The ActiveSession is transferred to the player.
public fun lock_wager(
    bankroll: &HouseBankroll,
    wager: Coin<OCT>,
    game_id: String,
    ctx: &mut TxContext,
): ID {
    assert!(!bankroll.paused, E_CASINO_PAUSED);

    let wager_amount = coin::value(&wager);

    // Validate bet size
    assert!(wager_amount >= bankroll.min_bet, E_BET_TOO_SMALL);
    assert!(wager_amount <= bankroll.max_bet, E_BET_TOO_LARGE);

    let player = ctx.sender();

    let session = ActiveSession {
        id: object::new(ctx),
        player,
        game_id,
        wager,
        wager_amount,
        created_at: ctx.epoch_timestamp_ms(),
    };

    let session_id = object::id(&session);

    // Emit event
    event::emit(SessionCreated {
        session_id,
        player,
        game_id: session.game_id,
        wager_amount,
    });

    // Transfer session object to the player
    transfer::transfer(session, player);

    session_id
}

/// Step 2: Resolve a session using the backend's signed multiplier.
///
/// The backend signs: BCS(session_id | player | multiplier_bps | nonce)
/// 
/// - multiplier_bps = 0: Player lost. Wager swept to house.
/// - multiplier_bps = 10000: Player breaks even (1.0x).
/// - multiplier_bps = 25000: Player wins 2.5x their wager.
public fun resolve_session(
    bankroll: &mut HouseBankroll,
    session: ActiveSession,
    multiplier_bps: u64,
    nonce: u64,
    server_signature: vector<u8>,
    ctx: &mut TxContext,
) {
    // Ensure server public key is configured
    assert!(vector::length(&bankroll.server_public_key) == 32, E_SERVER_KEY_NOT_SET);

    // Prevent replay
    assert!(!table::contains(&bankroll.used_nonces, nonce), E_NONCE_ALREADY_USED);
    table::add(&mut bankroll.used_nonces, nonce, true);

    // Destructure the session
    let ActiveSession {
        id,
        player,
        game_id,
        wager,
        wager_amount,
        created_at: _,
    } = session;

    let session_id = object::uid_to_inner(&id);

    // Reconstruct the message the server signed:
    // BCS-serialized: session_id | player | multiplier_bps | nonce
    let mut msg = vector::empty<u8>();
    let session_id_bytes = bcs::to_bytes(&session_id);
    let player_bytes = bcs::to_bytes(&player);
    let multiplier_bytes = bcs::to_bytes(&multiplier_bps);
    let nonce_bytes = bcs::to_bytes(&nonce);
    vector::append(&mut msg, session_id_bytes);
    vector::append(&mut msg, player_bytes);
    vector::append(&mut msg, multiplier_bytes);
    vector::append(&mut msg, nonce_bytes);

    // Verify the server's ed25519 signature
    assert!(
        ed25519::ed25519_verify(&server_signature, &bankroll.server_public_key, &msg),
        E_INVALID_SIGNATURE,
    );

    // Delete session object
    object::delete(id);

    if (multiplier_bps == 0) {
        // Player lost — sweep wager to house bankroll
        balance::join(&mut bankroll.balance, coin::into_balance(wager));

        event::emit(SessionResolved {
            session_id,
            player,
            game_id,
            wager_amount,
            multiplier_bps: 0,
            payout: 0,
            won: false,
        });
    } else {
        // Player won (or broke even)
        let payout = (wager_amount * multiplier_bps) / MAX_BPS;

        // Check bankroll can cover the net payout (payout - wager, since wager returns to pool first)
        // First, add the wager to the bankroll
        balance::join(&mut bankroll.balance, coin::into_balance(wager));

        // Check we have enough to pay out
        assert!(balance::value(&bankroll.balance) >= payout, E_INSUFFICIENT_BANKROLL);

        // Check against max payout limit
        let max_allowed_payout = (balance::value(&bankroll.balance) * bankroll.max_payout_bps) / MAX_BPS;
        assert!(payout <= max_allowed_payout, E_PAYOUT_EXCEEDS_MAX);

        // Pay the player
        let payout_coin = coin::take(&mut bankroll.balance, payout, ctx);
        transfer::public_transfer(payout_coin, player);

        bankroll.total_payouts = bankroll.total_payouts + payout;

        event::emit(SessionResolved {
            session_id,
            player,
            game_id,
            wager_amount,
            multiplier_bps,
            payout,
            won: true,
        });
    };

    // Update lifetime stats
    bankroll.total_wagers = bankroll.total_wagers + wager_amount;
    bankroll.total_games = bankroll.total_games + 1;
}

// ============= View Helper Functions =============

/// Get the current bankroll balance.
public fun get_bankroll_balance(bankroll: &HouseBankroll): u64 {
    balance::value(&bankroll.balance)
}

/// Get the house edge in basis points.
public fun get_house_edge_bps(bankroll: &HouseBankroll): u64 {
    bankroll.house_edge_bps
}

/// Get the min and max bet limits.
public fun get_min_bet(bankroll: &HouseBankroll): u64 {
    bankroll.min_bet
}

public fun get_max_bet(bankroll: &HouseBankroll): u64 {
    bankroll.max_bet
}

/// Get lifetime stats: total_wagers, total_payouts, total_games.
public fun get_total_wagers(bankroll: &HouseBankroll): u64 {
    bankroll.total_wagers
}

public fun get_total_payouts(bankroll: &HouseBankroll): u64 {
    bankroll.total_payouts
}

public fun get_total_games(bankroll: &HouseBankroll): u64 {
    bankroll.total_games
}

/// Check if the casino is paused.
public fun is_paused(bankroll: &HouseBankroll): bool {
    bankroll.paused
}

/// Get the max payout bps.
public fun get_max_payout_bps(bankroll: &HouseBankroll): u64 {
    bankroll.max_payout_bps
}

/// Get session info: player, game_id, wager_amount.
public fun session_player(session: &ActiveSession): address {
    session.player
}

public fun session_game_id(session: &ActiveSession): String {
    session.game_id
}

public fun session_wager_amount(session: &ActiveSession): u64 {
    session.wager_amount
}

/// Get session creation timestamp (epoch ms).
public fun session_created_at(session: &ActiveSession): u64 {
    session.created_at
}
