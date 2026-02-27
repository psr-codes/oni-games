"use client";

import { useSuiClientQuery } from "@mysten/dapp-kit";
import { GAME_STORE_ID } from "@/config";
import { useMemo } from "react";

export interface GameStoreData {
  treasury: string;
  mintFee: number;
  marketFeeBps: number;
  totalMinted: number;
  serverPublicKey: string;
}

export function useGameStore() {
  const { data, isPending, error, refetch } = useSuiClientQuery("getObject", {
    id: GAME_STORE_ID,
    options: { showContent: true },
  });

  const gameStore: GameStoreData | null = useMemo(() => {
    if (!data?.data?.content || data.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = data.data.content.fields as Record<string, any>;

    return {
      treasury: fields.treasury || "",
      mintFee: Number(fields.mint_fee || 0),
      marketFeeBps: Number(fields.market_fee_bps || 0),
      totalMinted: Number(fields.total_minted || 0),
      serverPublicKey: formatPublicKey(fields.server_public_key),
    };
  }, [data]);

  return { gameStore, isPending, error, refetch };
}

function formatPublicKey(key: any): string {
  if (!key) return "";
  // The key comes as a vector<u8> which may be serialized as an array of numbers
  if (Array.isArray(key)) {
    return key.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }
  if (typeof key === "string") return key;
  return "";
}
