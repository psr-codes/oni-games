const { bcs } = require('@mysten/bcs');
const { ed25519 } = require('@noble/curves/ed25519');

const sessionId = "0xba6e5a1f9c1b8c2b697a08d02c980f3fb35fa0fe1b002360097ee01806f48723";
const playerAddress = "0x71eef8a76d4d177c6dce3ed247a33f21ae282611e1e488e1a99de257e74147de";
const multiplierBps = 10000;
const nonce = Date.now() * 1000;

try {
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
    
    console.log("Serialization successful");
} catch (e) {
    console.error("BCS Error:", e);
}
