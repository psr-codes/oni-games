#!/usr/bin/env npx tsx
/**
 * Print the ed25519 public key derived from ADMIN_PRIVATE_KEY.
 * Use this public key in the admin panel "Server Public Key" field.
 *
 * Usage:  npx tsx scripts/print-public-key.ts
 */

import { ed25519 } from "@noble/curves/ed25519";

// Hardcode or read from env — paste your ADMIN_PRIVATE_KEY here if needed
const PRIVATE_KEY = process.argv[2] || process.env.ADMIN_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("Usage: npx tsx scripts/print-public-key.ts <private_key_hex>");
  console.error("  or set ADMIN_PRIVATE_KEY env var");
  process.exit(1);
}

const privateKeyBytes = Buffer.from(PRIVATE_KEY.replace("0x", ""), "hex");
const publicKey = ed25519.getPublicKey(privateKeyBytes);

console.log("=== Derived ed25519 Public Key ===\n");
console.log("PUBLIC KEY (hex, set on-chain via admin panel):");
console.log(Buffer.from(publicKey).toString("hex"));
console.log("\nLength:", publicKey.length, "bytes");
