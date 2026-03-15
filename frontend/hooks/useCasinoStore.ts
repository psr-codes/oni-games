"use client";

import { useSuiClientQuery } from "@mysten/dapp-kit";
import { HOUSE_BANKROLL_ID } from "@/config";
import { useMemo } from "react";

export interface CasinoStoreData {
  treasury: string;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  maxPayoutBps: number;
  totalWagers: number;
  totalPayouts: number;
  totalGames: number;
  paused: boolean;
  bankrollBalance: number;
  serverPublicKey: string;
}

export function useCasinoStore() {
  const { data, isPending, error, refetch } = useSuiClientQuery("getObject", {
    id: HOUSE_BANKROLL_ID,
    options: { showContent: true },
  });

  const casinoStore: CasinoStoreData | null = useMemo(() => {
    if (!data?.data?.content || data.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = data.data.content.fields as Record<string, any>;

    return {
      treasury: fields.treasury || "",
      houseEdgeBps: Number(fields.house_edge_bps || 0),
      minBet: Number(fields.min_bet || 0),
      maxBet: Number(fields.max_bet || 0),
      maxPayoutBps: Number(fields.max_payout_bps || 0),
      totalWagers: Number(fields.total_wagers || 0),
      totalPayouts: Number(fields.total_payouts || 0),
      totalGames: Number(fields.total_games || 0),
      paused: Boolean(fields.paused),
      bankrollBalance: Number(fields.balance || 0),
      serverPublicKey: formatPublicKey(fields.server_public_key),
    };
  }, [data]);

  return { casinoStore, isPending, error, refetch };
}

function formatPublicKey(key: any): string {
  if (!key) return "";
  if (Array.isArray(key)) {
    return key.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }
  if (typeof key === "string") return key;
  return "";
}
