/**
 * Turn raw on-chain errors into something a user can read.
 * Targets the "TransferChecked / insufficient funds" pattern primarily.
 */
export function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient funds/i.test(msg) || /Error: insufficient/i.test(msg)) {
    return "Not enough funds. Top up USDG (or SOL for tx fees) and try again.";
  }
  if (/MarketNotExpired/i.test(msg)) {
    return "Market hasn't expired yet — wait for the resolution timer.";
  }
  if (/MarketAlreadyResolved/i.test(msg)) {
    return "Market is already resolved.";
  }
  if (/VaultNotLaunchable/i.test(msg)) {
    return "Vault not launchable yet (commit phase still active or not enough committed).";
  }
  if (/AlreadyProcessed/i.test(msg)) {
    return "Already claimed or refunded.";
  }
  if (/Unauthorized/i.test(msg)) {
    return "You aren't authorised to do that.";
  }
  if (/User rejected/i.test(msg) || /rejected/i.test(msg)) {
    return "Transaction cancelled.";
  }
  // Fallback: trim long simulation logs
  return msg.length > 240 ? msg.slice(0, 240) + "…" : msg;
}
