import { NextRequest, NextResponse } from "next/server";
import { bcs } from "@mysten/bcs";
import { ed25519 } from "@noble/curves/ed25519";

// Ensure the admin private key exists for signing
const SIGNING_KEY = process.env.ADMIN_PRIVATE_KEY!;

/**
 * POST /api/resolve-session
 *
 * Backend securely signs a session resolution for Casino Category B games
 * (like Minesweeper / Crypto Crash).
 * The user submits the signed transaction via the client to claim winnings.
 *
 * Request:  { sessionId: string, playerAddress: string, multiplierBps: number }
 * Response: { signature: string, nonce: number }
 */
export async function POST(req: NextRequest) {
  try {
    if (!SIGNING_KEY) {
      return NextResponse.json(
        { error: "SIGNING_KEY not configured on server" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { sessionId, playerAddress, multiplierBps } = body;

    // Validate inputs
    if (!sessionId || !playerAddress || multiplierBps === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, playerAddress, multiplierBps" },
        { status: 400 }
      );
    }

    // Generate unique nonce (timestamp * 1000 + random)
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    // ---- BCS-serialize the message (must precisely match the Move contract) ----
    // Contract code msg reconstruction:
    // let session_id_bytes = bcs::to_bytes(&session_id); // 32 bytes
    // let player_bytes = bcs::to_bytes(&player);         // 32 bytes
    // let multiplier_bytes = bcs::to_bytes(&multiplier_bps); // u64 LE
    // let nonce_bytes = bcs::to_bytes(&nonce);           // u64 LE

    const sessionIdBytes = bcs
      .bytes(32)
      .serialize(Buffer.from(sessionId.replace("0x", ""), "hex"))
      .toBytes();
    const playerBytes = bcs
      .bytes(32)
      .serialize(Buffer.from(playerAddress.replace("0x", ""), "hex"))
      .toBytes();
    const multiplierBytes = bcs.u64().serialize(multiplierBps).toBytes();
    const nonceBytes = bcs.u64().serialize(nonce).toBytes();

    // Concatenate bits
    const msg = new Uint8Array(
      sessionIdBytes.length +
        playerBytes.length +
        multiplierBytes.length +
        nonceBytes.length
    );
    let offset = 0;
    msg.set(sessionIdBytes, offset);
    offset += sessionIdBytes.length;
    msg.set(playerBytes, offset);
    offset += playerBytes.length;
    msg.set(multiplierBytes, offset);
    offset += multiplierBytes.length;
    msg.set(nonceBytes, offset);

    console.log("[resolve-session] Session:", sessionId);
    console.log("[resolve-session] Player:", playerAddress);
    console.log("[resolve-session] Multiplier BPS:", multiplierBps, "Nonce:", nonce);

    // Sign with ed25519
    const privateKeyBytes = Buffer.from(SIGNING_KEY, "hex");
    const signature = ed25519.sign(msg, privateKeyBytes);

    return NextResponse.json({
      signature: Buffer.from(signature).toString("hex"),
      nonce,
    });
  } catch (error: any) {
    console.error("[resolve-session] Error:", error);
    return NextResponse.json(
      { error: "Failed to sign session resolution", details: error.message },
      { status: 500 }
    );
  }
}
