"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { ADMIN_ADDRESS } from "@/config";

export function useAdmin() {
  const account = useCurrentAccount();

  const isAdmin =
    !!account?.address &&
    account.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  return {
    isAdmin,
    address: account?.address ?? null,
    isConnected: !!account,
  };
}
