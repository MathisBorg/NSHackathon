import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/kv";

/**
 * Tracks the cumulative $ a non-committer (audience) has bet on a vault.
 * Committers' "bet" is on-chain via CommitterPosition.yes/no_amount.
 *
 * POST { vault, pubkey, units, side? }
 *   - increments hash vault:<id>:bets by pubkey
 *   - if side is "yes" / "no", also increments vault:<id>:bets:<side>:total
 * GET ?vault=X
 *   → { bets, sideTotals: { yes, no } }
 */
const TTL_SECONDS = 30 * 24 * 3600;

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true, stored: false });
  try {
    const body = await req.json();
    const vault = body?.vault;
    const pubkey = body?.pubkey;
    const units = body?.units;
    const side = body?.side; // "yes" | "no" | undefined
    if (
      typeof vault !== "string" ||
      typeof pubkey !== "string" ||
      (typeof units !== "string" && typeof units !== "number")
    ) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const n = Number(units);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "bad units" }, { status: 400 });
    }
    const key = `vault:${vault}:bets`;
    await redis.hincrby(key, pubkey, Math.floor(n));
    await redis.expire(key, TTL_SECONDS);

    if (side === "yes" || side === "no") {
      const sideKey = `vault:${vault}:bets:${side}:total`;
      await redis.incrby(sideKey, Math.floor(n));
      await redis.expire(sideKey, TTL_SECONDS);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const redis = getRedis();
  if (!redis)
    return NextResponse.json({
      ok: true,
      bets: {},
      sideTotals: { yes: "0", no: "0" },
    });
  try {
    const vault = req.nextUrl.searchParams.get("vault");
    if (!vault) {
      return NextResponse.json({ error: "missing vault" }, { status: 400 });
    }
    const [map, yesT, noT] = await Promise.all([
      redis.hgetall<Record<string, string | number>>(`vault:${vault}:bets`),
      redis.get<string | number>(`vault:${vault}:bets:yes:total`),
      redis.get<string | number>(`vault:${vault}:bets:no:total`),
    ]);
    const bets: Record<string, string> = {};
    for (const [k, v] of Object.entries(map ?? {})) {
      bets[k] = v.toString();
    }
    return NextResponse.json({
      ok: true,
      bets,
      sideTotals: {
        yes: yesT ? yesT.toString() : "0",
        no: noT ? noT.toString() : "0",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
