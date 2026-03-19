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

export const PREVIOUS_PACKAGE_IDS = [
  "0x209cd73356acc6c529b627ae4d6e83493a3e2598159afe9948b95c6251c40b52", // v3
  "0x6827acf4e5e8ed5392f2774c9375815b74e05ab66b0c6b0dcc5fafec8cde24a2", // v2
  "0x1aa0aa825a1074eee7e56077e54efdddda39d22828f374f67d5583d50840c102"  // v1
];
