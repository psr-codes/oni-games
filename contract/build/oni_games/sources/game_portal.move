/// Oni Games — Web3 Arcade Portal Smart Contract
/// 
/// This contract handles:
/// 1. Minting Score NFTs for verified game scores
/// 2. Maintaining on-chain leaderboards per game
/// 3. A simple NFT marketplace (list/buy/delist) with configurable platform fee
/// 4. Admin-controlled score verification (admin-submitted / gasless mint)
#[allow(lint(self_transfer), duplicate_alias)]
module oni_games::game_portal;

use one::coin::{Self, Coin};
use one::oct::OCT;
use one::table::{Self, Table};
use one::event;
use one::ed25519;
use one::bcs;
use std::string::String;

// ============= Error Codes =============
const E_NONCE_ALREADY_USED: u64 = 1;
const E_INSUFFICIENT_PAYMENT: u64 = 2;
const E_NOT_OWNER: u64 = 3;
const E_INVALID_PRICE: u64 = 5;
const E_INVALID_FEE_BPS: u64 = 7;
const E_INVALID_SIGNATURE: u64 = 8;
const E_SERVER_KEY_NOT_SET: u64 = 9;

// ============= Constants =============
const MAX_LEADERBOARD_SIZE: u64 = 10;
/// Maximum basis points (100% = 10_000 BPS)
const MAX_BPS: u64 = 10_000;

// ============= Structs =============

/// One-time admin capability object, created on module init.
/// Only the deployer holds this.
public struct AdminCap has key {
    id: UID,
}

/// Shared global state for the game portal.
/// Holds config, leaderboards, used nonces, and marketplace settings.
public struct GameStore has key {
    id: UID,
    /// Treasury address where mint fees and marketplace cuts are sent
    treasury: address,
    /// Mint fee in MIST (1 OCT = 1_000_000_000 MIST). 0 = free minting.
    mint_fee: u64,
    /// Marketplace fee in basis points (e.g. 250 = 2.5%). Applied to buy_nft.
    market_fee_bps: u64,
    /// Total number of NFTs minted across all games
    total_minted: u64,
    /// Leaderboard: game_id (slug) -> vector of top leaderboard entries
    leaderboards: Table<String, vector<LeaderboardEntry>>,
    /// Used nonces to prevent replay attacks
    used_nonces: Table<u64, bool>,
    /// Server's ed25519 public key (32 bytes) for verifying user-submitted mints
    server_public_key: vector<u8>,
}

/// The NFT minted for a verified game score.
/// Owned by the player who earned it.
public struct ScoreNFT has key, store {
    id: UID,
    /// Game identifier (slug), e.g. "tetris"
    game_id: String,
    /// Human-readable game name, e.g. "Tetris Classic"
    game_name: String,
    /// The verified score
    score: u64,
    /// Player who earned the score
    player: address,
    /// URL to the game thumbnail image
    image_url: String,
    /// Sequential mint number (global)
    mint_number: u64,
}

/// A single entry in a game's leaderboard.
public struct LeaderboardEntry has store, copy, drop {
    player: address,
    score: u64,
    nft_id: ID,
}

/// A marketplace listing for a ScoreNFT.
/// Created when a player lists their NFT for sale.
public struct Listing has key, store {
    id: UID,
    nft: ScoreNFT,
    price: u64,
    seller: address,
}

// ============= Events =============

/// Emitted when a new Score NFT is minted.
public struct ScoreMinted has copy, drop {
    nft_id: ID,
    game_id: String,
    player: address,
    score: u64,
    mint_number: u64,
}

/// Emitted when an NFT is listed for sale.
public struct NFTListed has copy, drop {
    listing_id: ID,
    nft_id: ID,
    game_id: String,
    price: u64,
    seller: address,
}

/// Emitted when an NFT is purchased.
public struct NFTPurchased has copy, drop {
    listing_id: ID,
    nft_id: ID,
    buyer: address,
    seller: address,
    price: u64,
    platform_fee: u64,
}

/// Emitted when an NFT listing is cancelled.
public struct NFTDelisted has copy, drop {
    listing_id: ID,
    nft_id: ID,
    seller: address,
}

// ============= Module Init =============

/// Called once when the module is published.
/// Creates AdminCap for deployer and shared GameStore.
fun init(ctx: &mut TxContext) {
    // Create admin capability and transfer to deployer
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());

    // Create shared game store
    let game_store = GameStore {
        id: object::new(ctx),
        treasury: ctx.sender(),
        mint_fee: 0,           // Free minting by default
        market_fee_bps: 250,   // 2.5% marketplace fee by default
        total_minted: 0,
        leaderboards: table::new(ctx),
        used_nonces: table::new(ctx),
        server_public_key: vector::empty<u8>(), // Must be set by admin before user mints
    };
    transfer::share_object(game_store);
}

// ============= Admin Functions =============

/// Update the mint fee. Only callable by admin.
public fun set_mint_fee(
    _admin: &AdminCap,
    store: &mut GameStore,
    new_fee: u64,
) {
    store.mint_fee = new_fee;
}

/// Update the treasury address. Only callable by admin.
public fun set_treasury(
    _admin: &AdminCap,
    store: &mut GameStore,
    new_treasury: address,
) {
    store.treasury = new_treasury;
}

/// Update the marketplace fee in basis points (BPS).
/// 100 BPS = 1%, 250 BPS = 2.5%, 1000 BPS = 10%.
/// Max is 10_000 BPS = 100% (but practically should be much lower).
public fun set_market_fee_bps(
    _admin: &AdminCap,
    store: &mut GameStore,
    new_bps: u64,
) {
    assert!(new_bps <= MAX_BPS, E_INVALID_FEE_BPS);
    store.market_fee_bps = new_bps;
}

/// Set the server's ed25519 public key used to verify user-submitted mints.
/// Must be called once after deploy before `mint_verified_score` can be used.
/// The key should be 32 bytes (raw ed25519 public key).
public fun set_server_public_key(
    _admin: &AdminCap,
    store: &mut GameStore,
    public_key: vector<u8>,
) {
    store.server_public_key = public_key;
}

// ============= Core Minting (Admin-Submitted / Gasless Mint) =============

/// Mint a Score NFT for a player. This uses the admin-submitted pattern where
/// the backend (holding the AdminCap) submits the transaction on behalf of the player
/// after verifying the score server-side.
///
/// This is simpler and equally secure — the backend is the gatekeeper.
/// The player pays no gas; the admin covers it.
public fun admin_mint_score_nft(
    _admin: &AdminCap,
    store: &mut GameStore,
    game_id: String,
    game_name: String,
    score: u64,
    player: address,
    image_url: String,
    nonce: u64,
    ctx: &mut TxContext,
) {
    // Verify nonce hasn't been used (prevents replay)
    assert!(!table::contains(&store.used_nonces, nonce), E_NONCE_ALREADY_USED);

    // Mark nonce as used
    table::add(&mut store.used_nonces, nonce, true);

    // Increment total minted
    store.total_minted = store.total_minted + 1;
    let mint_number = store.total_minted;

    // Create ScoreNFT
    let nft = ScoreNFT {
        id: object::new(ctx),
        game_id,
        game_name,
        score,
        player,
        image_url,
        mint_number,
    };

    let nft_id = object::id(&nft);

    // Update leaderboard
    update_leaderboard(store, nft.game_id, player, score, nft_id);

    // Emit event
    event::emit(ScoreMinted {
        nft_id,
        game_id: nft.game_id,
        player,
        score,
        mint_number,
    });

    // Transfer NFT to the player
    transfer::transfer(nft, player);
}

/// Mint a Score NFT where a fee is paid (e.g. by the admin on behalf of the user,
/// or by the user directly if the contract is configured that way).
/// 
/// IMPORTANT: This function properly handles coin splitting.
/// If the payment coin is worth more than the required fee, the exact fee
/// is split out and sent to the treasury, and the remaining change is
/// refunded back to the transaction sender.
public fun mint_score_nft_with_fee(
    _admin: &AdminCap,
    store: &mut GameStore,
    game_id: String,
    game_name: String,
    score: u64,
    player: address,
    image_url: String,
    nonce: u64,
    mut payment: Coin<OCT>,
    ctx: &mut TxContext,
) {
    // Verify payment amount
    let fee = store.mint_fee;
    assert!(payment.value() >= fee, E_INSUFFICIENT_PAYMENT);

    // Split exact fee from payment, send fee to treasury
    let fee_coin = payment.split(fee, ctx);
    transfer::public_transfer(fee_coin, store.treasury);

    // Refund remaining change back to the tx sender
    if (payment.value() > 0) {
        transfer::public_transfer(payment, ctx.sender());
    } else {
        // Destroy the zero-value coin to avoid "unused value" errors
        coin::destroy_zero(payment);
    };

    // Delegate to the no-fee mint
    admin_mint_score_nft(
        _admin,
        store,
        game_id,
        game_name,
        score,
        player,
        image_url,
        nonce,
        ctx,
    );
}

// ============= User-Pays Minting (Signature-Verified) =============

/// Mint a Score NFT where the USER submits the transaction and pays gas.
/// The backend provides an ed25519 signature proving the score is legit.
///
/// Flow:
/// 1. Player finishes game, frontend sends score to backend API
/// 2. Backend verifies score, signs message: BCS(player | game_id | score | nonce)
/// 3. Backend returns {signature, nonce} to frontend
/// 4. Frontend builds tx calling this function with the signature
/// 5. User's OneWallet signs & submits the tx (user pays gas)
/// 6. Contract verifies signature on-chain, mints NFT to caller
public fun mint_verified_score(
    store: &mut GameStore,
    game_id: String,
    game_name: String,
    score: u64,
    image_url: String,
    nonce: u64,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    // Ensure server public key has been configured
    assert!(vector::length(&store.server_public_key) == 32, E_SERVER_KEY_NOT_SET);

    // Verify nonce hasn't been used (prevents replay)
    assert!(!table::contains(&store.used_nonces, nonce), E_NONCE_ALREADY_USED);

    let player = ctx.sender();

    // Reconstruct the message that the server signed:
    // BCS-serialized: player address + game_id + score + nonce
    let mut msg = vector::empty<u8>();
    let player_bytes = bcs::to_bytes(&player);
    let game_id_bytes = bcs::to_bytes(&game_id);
    let score_bytes = bcs::to_bytes(&score);
    let nonce_bytes = bcs::to_bytes(&nonce);
    vector::append(&mut msg, player_bytes);
    vector::append(&mut msg, game_id_bytes);
    vector::append(&mut msg, score_bytes);
    vector::append(&mut msg, nonce_bytes);

    // Verify the server's ed25519 signature
    assert!(
        ed25519::ed25519_verify(&signature, &store.server_public_key, &msg),
        E_INVALID_SIGNATURE,
    );

    // Mark nonce as used
    table::add(&mut store.used_nonces, nonce, true);

    // Increment total minted
    store.total_minted = store.total_minted + 1;
    let mint_number = store.total_minted;

    // Create ScoreNFT
    let nft = ScoreNFT {
        id: object::new(ctx),
        game_id,
        game_name,
        score,
        player,
        image_url,
        mint_number,
    };

    let nft_id = object::id(&nft);

    // Update leaderboard
    update_leaderboard(store, nft.game_id, player, score, nft_id);

    // Emit event
    event::emit(ScoreMinted {
        nft_id,
        game_id: nft.game_id,
        player,
        score,
        mint_number,
    });

    // Transfer NFT to the player (caller)
    transfer::transfer(nft, player);
}

// ============= Leaderboard =============

/// Internal function to update the leaderboard for a game.
/// Inserts the new score in sorted (descending) order and trims to MAX_LEADERBOARD_SIZE.
/// 
/// Tie-breaker: newer scores with the same value as the lowest entry REPLACE
/// the oldest lowest entry (using `<` not `<=`). This favors newer players.
fun update_leaderboard(
    store: &mut GameStore,
    game_id: String,
    player: address,
    score: u64,
    nft_id: ID,
) {
    let entry = LeaderboardEntry { player, score, nft_id };

    if (!table::contains(&store.leaderboards, game_id)) {
        // Create new leaderboard for this game
        let mut entries = vector::empty<LeaderboardEntry>();
        vector::push_back(&mut entries, entry);
        table::add(&mut store.leaderboards, game_id, entries);
    } else {
        let entries = table::borrow_mut(&mut store.leaderboards, game_id);
        let len = vector::length(entries);

        // If leaderboard is full, check if new score qualifies
        if (len >= MAX_LEADERBOARD_SIZE) {
            let lowest = vector::borrow(entries, len - 1);
            // Using `<` (not `<=`) so newer ties REPLACE the oldest lowest entry
            if (score < lowest.score) {
                return // Score doesn't qualify at all
            };
            // Remove the lowest entry to make room
            vector::pop_back(entries);
        };

        // Insert in sorted position (descending by score)
        let mut i = vector::length(entries);
        vector::push_back(entries, entry); // Add to end temporarily

        // Bubble up to correct position
        while (i > 0) {
            let prev = vector::borrow(entries, i - 1);
            if (score > prev.score) {
                vector::swap(entries, i, i - 1);
                i = i - 1;
            } else {
                break
            };
        };
    };
}

/// Get the top scores for a specific game.
/// Returns the leaderboard entries (read-only).
public fun get_leaderboard(
    store: &GameStore,
    game_id: String,
): &vector<LeaderboardEntry> {
    table::borrow(&store.leaderboards, game_id)
}

/// Check if a leaderboard exists for a game.
public fun has_leaderboard(
    store: &GameStore,
    game_id: String,
): bool {
    table::contains(&store.leaderboards, game_id)
}

// ============= Marketplace =============

/// List a ScoreNFT for sale on the marketplace.
/// The NFT is transferred into the Listing object (escrow).
public fun list_nft_for_sale(
    nft: ScoreNFT,
    price: u64,
    ctx: &mut TxContext,
) {
    assert!(price > 0, E_INVALID_PRICE);
    let seller = ctx.sender();
    assert!(nft.player == seller, E_NOT_OWNER);

    let nft_id = object::id(&nft);
    let game_id = nft.game_id;

    let listing = Listing {
        id: object::new(ctx),
        nft,
        price,
        seller,
    };

    let listing_id = object::id(&listing);

    event::emit(NFTListed {
        listing_id,
        nft_id,
        game_id,
        price,
        seller,
    });

    // Share the listing so anyone can buy it
    transfer::share_object(listing);
}

/// Purchase a listed ScoreNFT.
/// 
/// Payment handling:
/// 1. The exact `price` is split from the payment coin.
/// 2. A platform fee (market_fee_bps) is taken from that price and sent to treasury.
/// 3. The remainder (price - fee) is sent to the seller.
/// 4. Any leftover change in the original payment is refunded to the buyer.
public fun buy_nft(
    store: &GameStore,
    listing: Listing,
    mut payment: Coin<OCT>,
    ctx: &mut TxContext,
) {
    let buyer = ctx.sender();
    let Listing { id, mut nft, price, seller } = listing;

    // Verify payment is sufficient
    assert!(payment.value() >= price, E_INSUFFICIENT_PAYMENT);

    let listing_id = object::uid_to_inner(&id);
    let nft_id = object::id(&nft);

    // Split the exact price amount from payment
    let mut price_coin = payment.split(price, ctx);

    // Calculate and split the platform fee from the price
    let platform_fee_amount = (price * store.market_fee_bps) / MAX_BPS;
    
    if (platform_fee_amount > 0) {
        let fee_coin = price_coin.split(platform_fee_amount, ctx);
        transfer::public_transfer(fee_coin, store.treasury);
    };

    // Send the remaining price (price - platform_fee) to seller
    transfer::public_transfer(price_coin, seller);

    // Refund any leftover change to buyer
    if (payment.value() > 0) {
        transfer::public_transfer(payment, buyer);
    } else {
        coin::destroy_zero(payment);
    };

    // Update NFT ownership
    nft.player = buyer;

    // Emit event
    event::emit(NFTPurchased {
        listing_id,
        nft_id,
        buyer,
        seller,
        price,
        platform_fee: platform_fee_amount,
    });

    // Transfer NFT to buyer
    transfer::transfer(nft, buyer);

    // Delete listing object
    object::delete(id);
}

/// Delist (cancel) a marketplace listing.
/// Only the original seller can delist.
public fun delist_nft(
    listing: Listing,
    ctx: &mut TxContext,
) {
    let seller = ctx.sender();
    let Listing { id, nft, price: _, seller: original_seller } = listing;

    assert!(seller == original_seller, E_NOT_OWNER);

    let listing_id = object::uid_to_inner(&id);
    let nft_id = object::id(&nft);

    event::emit(NFTDelisted {
        listing_id,
        nft_id,
        seller,
    });

    // Return NFT to the seller
    transfer::transfer(nft, seller);

    // Delete listing object
    object::delete(id);
}

// ============= View Helper Functions =============

/// Get the game_id of a ScoreNFT.
public fun nft_game_id(nft: &ScoreNFT): String {
    nft.game_id
}

/// Get the score of a ScoreNFT.
public fun nft_score(nft: &ScoreNFT): u64 {
    nft.score
}

/// Get the player of a ScoreNFT.
public fun nft_player(nft: &ScoreNFT): address {
    nft.player
}

/// Get the mint number of a ScoreNFT.
public fun nft_mint_number(nft: &ScoreNFT): u64 {
    nft.mint_number
}

/// Get the total number of NFTs minted.
public fun total_minted(store: &GameStore): u64 {
    store.total_minted
}

/// Get the current mint fee.
public fun get_mint_fee(store: &GameStore): u64 {
    store.mint_fee
}

/// Get the current marketplace fee in basis points.
public fun get_market_fee_bps(store: &GameStore): u64 {
    store.market_fee_bps
}

/// Get listing price.
public fun listing_price(listing: &Listing): u64 {
    listing.price
}

/// Get listing seller.
public fun listing_seller(listing: &Listing): address {
    listing.seller
}
