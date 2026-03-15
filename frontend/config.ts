// Contract deployment config — sourced from env vars

// Game Portal (Arcade)
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
export const GAME_STORE_ID = process.env.NEXT_PUBLIC_GAME_STORE_ID!;
export const ADMIN_CAP_ID = process.env.NEXT_PUBLIC_ADMIN_CAP_ID!;
export const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS!;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
export const MODULE = process.env.NEXT_PUBLIC_MODULE!;
export const COIN_TYPE = process.env.NEXT_PUBLIC_COIN_TYPE!;

// Casino (GambleFi)
export const CASINO_MODULE = process.env.NEXT_PUBLIC_CASINO_MODULE || "casino";
export const HOUSE_BANKROLL_ID = process.env.NEXT_PUBLIC_HOUSE_BANKROLL_ID!;
export const CASINO_ADMIN_CAP_ID = process.env.NEXT_PUBLIC_CASINO_ADMIN_CAP_ID!;
