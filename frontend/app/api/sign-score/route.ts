import { NextRequest, NextResponse } from "next/server";
import { bcs } from "@mysten/bcs";
import { ed25519 } from "@noble/curves/ed25519";

// Reuse the admin private key for score signing (it's already ed25519)
const SIGNING_KEY = process.env.ADMIN_PRIVATE_KEY!;

// Game metadata (shared with /api/mint)
const GAME_META: Record<string, { name: string; imageUrl: string }> = {
  tetris: {
    name: "Tetris",
    imageUrl:
      "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9f1.png",
  },
  snake: {
    name: "Snake",
    imageUrl:
      "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f40d.png",
  },
  "2048": {
    name: "2048",
    imageUrl:
      "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f522.png",
  },
};

/**
 * POST /api/sign-score
 *
 * Backend signs the player's score with ed25519 so the contract can verify it.
 * The user then submits the transaction themselves and pays gas.
 *
 * Request:  { playerAddress, gameId, score }
 * Response: { signature, nonce, gameName, imageUrl }
 */
export async function POST(req: NextRequest) {
  try {
    if (!SIGNING_KEY) {
      return NextResponse.json(
        { error: "SIGNING_KEY not configured" },
        { status: 500 }
      );
    }

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

    const meta = GAME_META[gameId] || { name: gameId, imageUrl: "" };

    // Generate unique nonce (timestamp * 1000 + random to avoid collisions)
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    // ---- BCS-serialize the message (must match contract's reconstruction) ----
    // Contract does: BCS(player) ++ BCS(game_id) ++ BCS(score) ++ BCS(nonce)
    //
    // - player:  address = 32 raw bytes (fixed, no length prefix)
    // - game_id: String   = uleb128 length prefix + UTF-8 bytes
    // - score:   u64      = 8 bytes little-endian
    // - nonce:   u64      = 8 bytes little-endian

    const playerBytes = bcs
      .bytes(32)
      .serialize(Buffer.from(playerAddress.replace("0x", ""), "hex"))
      .toBytes();
    const gameIdBytes = bcs.string().serialize(gameId).toBytes();
    const scoreBytes = bcs.u64().serialize(score).toBytes();
    const nonceBytes = bcs.u64().serialize(nonce).toBytes();

    // Concatenate all parts
    const msg = new Uint8Array(
      playerBytes.length +
        gameIdBytes.length +
        scoreBytes.length +
        nonceBytes.length
    );
    let offset = 0;
    msg.set(playerBytes, offset);
    offset += playerBytes.length;
    msg.set(gameIdBytes, offset);
    offset += gameIdBytes.length;
    msg.set(scoreBytes, offset);
    offset += scoreBytes.length;
    msg.set(nonceBytes, offset);

    console.log("[sign-score] Player:", playerAddress);
    console.log("[sign-score] Game:", gameId, "Score:", score, "Nonce:", nonce);
    console.log("[sign-score] Message length:", msg.length, "bytes");

    // Sign with ed25519
    const privateKeyBytes = Buffer.from(SIGNING_KEY, "hex");
    const signature = ed25519.sign(msg, privateKeyBytes);

    console.log(
      "[sign-score] Signature:",
      Buffer.from(signature).toString("hex").slice(0, 20) + "..."
    );

    return NextResponse.json({
      signature: Buffer.from(signature).toString("hex"),
      nonce,
      gameName: meta.name,
      imageUrl: meta.imageUrl,
    });
  } catch (error: any) {
    console.error("[sign-score] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to sign score",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
