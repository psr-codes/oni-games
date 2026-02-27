import { NextRequest, NextResponse } from "next/server";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const MODULE = process.env.NEXT_PUBLIC_MODULE!;
const GAME_STORE_ID = process.env.NEXT_PUBLIC_GAME_STORE_ID!;
const ADMIN_CAP_ID = process.env.NEXT_PUBLIC_ADMIN_CAP_ID!;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;

// Game metadata
const GAME_META: Record<string, { name: string; imageUrl: string }> = {
  tetris: {
    name: "Tetris",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9f1.png",
  },
  snake: {
    name: "Snake",
    imageUrl: "https://em-content.zobj.net/source/apple/391/snake_1f40d.png",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerAddress, gameId, score } = body;

    // Validate inputs
    if (!playerAddress || !gameId || score === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: playerAddress, gameId, score" },
        { status: 400 }
      );
    }

    if (typeof score !== "number" || score < 0) {
      return NextResponse.json(
        { error: "Score must be a non-negative number" },
        { status: 400 }
      );
    }

    const client = new SuiClient({ url: RPC_URL });
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(ADMIN_PRIVATE_KEY, "hex")
    );
    const adminAddress = keypair.getPublicKey().toSuiAddress();

    console.log("[mint] Admin address:", adminAddress);
    console.log("[mint] Player:", playerAddress, "Game:", gameId, "Score:", score);

    const meta = GAME_META[gameId] || { name: gameId, imageUrl: "" };

    // Generate a unique nonce (timestamp + random)
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    // Fetch OCT gas coins (OneChain uses OCT, not SUI)
    const gasCoins = await client.getCoins({
      owner: adminAddress,
      coinType: "0x2::oct::OCT",
    });

    console.log("[mint] Gas coins found:", gasCoins.data.length);

    if (gasCoins.data.length === 0) {
      return NextResponse.json(
        { error: "Admin wallet has no OCT for gas. Please fund the admin wallet." },
        { status: 500 }
      );
    }

    // Build the transaction
    const tx = new Transaction();
    tx.setSender(adminAddress);

    // Explicitly set gas payment using OCT coins
    tx.setGasPayment(
      gasCoins.data.map((coin) => ({
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
      }))
    );

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE}::admin_mint_score_nft`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(GAME_STORE_ID),
        tx.pure.string(gameId),
        tx.pure.string(meta.name),
        tx.pure.u64(score),
        tx.pure.address(playerAddress),
        tx.pure.string(meta.imageUrl),
        tx.pure.u64(nonce),
      ],
    });

    console.log("[mint] Signing and executing transaction...");

    // Sign and execute
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
    });

    console.log("[mint] TX digest:", result.digest);

    // Wait for confirmation
    const txResponse = await client.waitForTransaction({
      digest: result.digest,
      options: { showEffects: true, showEvents: true },
    });

    // Extract the NFT object ID from created objects
    let nftId: string | null = null;
    const created = txResponse.effects?.created;
    if (created && created.length > 0) {
      nftId = created[0].reference.objectId;
    }

    console.log("[mint] Success! NFT ID:", nftId);

    return NextResponse.json({
      success: true,
      digest: result.digest,
      nftId,
      score,
      gameId,
      playerAddress,
    });
  } catch (error: any) {
    console.error("[mint] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to mint NFT",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
