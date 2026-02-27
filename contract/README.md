# Oni Games — Smart Contract

Move smart contract for the Oni Games Web3 Arcade Portal on OneChain.

## Architecture

| Struct             | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `AdminCap`         | One-time admin capability (deployer only)         |
| `GameStore`        | Shared global state: leaderboards, nonces, config |
| `ScoreNFT`         | The NFT minted for a verified score               |
| `LeaderboardEntry` | A single entry in a game's top-10                 |
| `Listing`          | A marketplace listing for a ScoreNFT              |

## Functions

### Admin Functions

- `set_mint_fee(admin, store, fee)` — Set the minting fee
- `set_treasury(admin, store, addr)` — Set the treasury address

### Core Minting

- `admin_mint_score_nft(admin, store, game_id, game_name, score, player, image_url, nonce)` — Mint a score NFT (free)
- `mint_score_nft_with_fee(admin, store, ..., payment)` — Mint with fee payment

### Marketplace

- `list_nft_for_sale(nft, price)` — List your NFT for sale
- `buy_nft(listing, payment)` — Buy a listed NFT
- `delist_nft(listing)` — Cancel a listing

### View Functions

- `get_leaderboard(store, game_id)` — Get top 10 for a game
- `nft_game_id/score/player/mint_number(nft)` — NFT field accessors
- `total_minted(store)` / `get_mint_fee(store)` — Store accessors

## Build & Deploy

```bash
# Prerequisites: Install the `one` CLI from OneChain docs

# Build the contract
cd contract
one move build

# Deploy to testnet
one client publish --gas-budget 100000000

# Note the Package ID and GameStore object ID from the output
```

## Network Details

- **RPC**: `https://rpc-testnet.onelabs.cc:443`
- **Faucet**: `https://faucet-testnet.onelabs.cc:443`
- **Explorer**: `https://onescan.cc/testnet`
- **Native Token**: OCT (9 decimals)
