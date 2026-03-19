"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState, useCallback } from "react";
import { PACKAGE_ID, CASINO_MODULE } from "@/config";

const MIST_PER_OCT = 1_000_000_000;

export interface SessionHistoryEntry {
  sessionId: string;
  player: string;
  gameId: string;
  wagerOCT: number;
  multiplierBps: number;
  payoutOCT: number;
  pnl: number;
  won: boolean;
  digest: string;
  timestamp?: number;
}

/**
 * Fetches on-chain session history for a specific game by querying
 * SessionResolved events (wins) and SessionCreated events (all bets).
 * Unresolved sessions (SessionCreated without matching SessionResolved) are losses.
 */
export function useSessionHistory(
  playerAddress: string | undefined,
  gameId: string,
  limit: number = 10,
) {
  const suiClient = useSuiClient();
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!playerAddress) return;
    setLoading(true);

    try {
      // 1. Query SessionResolved events (these represent completed sessions — wins)
      const resolvedEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${CASINO_MODULE}::SessionResolved`,
        },
        order: "descending",
        limit: 50,
      });

      const resolvedEntries: SessionHistoryEntry[] = resolvedEvents.data
        .filter((e) => {
          const parsed = e.parsedJson as any;
          return parsed.player === playerAddress && parsed.game_id === gameId;
        })
        .map((e) => {
          const p = e.parsedJson as any;
          const wagerOCT = Number(p.wager_amount) / MIST_PER_OCT;
          const payoutOCT = Number(p.payout) / MIST_PER_OCT;
          const won = Boolean(p.won);
          return {
            sessionId: String(p.session_id),
            player: String(p.player),
            gameId: String(p.game_id),
            wagerOCT,
            multiplierBps: Number(p.multiplier_bps),
            payoutOCT,
            pnl: won ? payoutOCT - wagerOCT : -wagerOCT,
            won,
            digest: e.id.txDigest,
            timestamp: e.timestampMs ? Number(e.timestampMs) : undefined,
          };
        });

      // 2. Query SessionCreated events to find unresolved sessions (losses via Option B)
      const createdEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${CASINO_MODULE}::SessionCreated`,
        },
        order: "descending",
        limit: 50,
      });

      // Build a set of session IDs that WERE resolved (won OR explicitly lost)
      const resolvedSessionIds = new Set(resolvedEntries.map((e) => e.sessionId));

      // Unresolved sessions = created but never resolved = Option B losses
      const unresolvedEntries: SessionHistoryEntry[] = createdEvents.data
        .filter((e) => {
          const parsed = e.parsedJson as any;
          return (
            parsed.player === playerAddress &&
            parsed.game_id === gameId &&
            !resolvedSessionIds.has(String(parsed.session_id))
          );
        })
        .map((e) => {
          const p = e.parsedJson as any;
          const wagerOCT = Number(p.wager_amount) / MIST_PER_OCT;
          return {
            sessionId: String(p.session_id),
            player: String(p.player),
            gameId: String(p.game_id),
            wagerOCT,
            multiplierBps: 0,
            payoutOCT: 0,
            pnl: -wagerOCT,
            won: false,
            digest: e.id.txDigest,
            timestamp: e.timestampMs ? Number(e.timestampMs) : undefined,
          };
        });

      // 3. Merge and sort by timestamp (most recent first)
      const all = [...resolvedEntries, ...unresolvedEntries]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limit);

      setHistory(all);
    } catch (err) {
      console.error("[useSessionHistory] Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [playerAddress, gameId, limit, suiClient]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return { history, loading, refetchHistory: loadHistory };
}
