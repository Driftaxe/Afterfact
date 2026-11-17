import { NextResponse, type NextRequest } from 'next/server';
import { getClientIp, hashIp } from '@/lib/iphistory/server';
import { SEED_HISTORY_CHECKS, type HistoryCheckItem } from '@/lib/iphistory';
import { db } from '@/server/db/client';
import { resolveOwnerHash } from '@/server/services/auth-helper';

/**
 * In-memory fallback IP history cache for demo & development.
 */
const inMemoryIpStore = new Map<string, HistoryCheckItem[]>();

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);
  const resolvedOwner = resolveOwnerHash(req);

  // 1. Query real historical verification runs from PostgreSQL via Prisma if configured
  if (process.env.DATABASE_URL) {
    try {
      const realRuns = await db.verificationRun.findMany({
        where: {
          OR: [
            { ipHash },
            { ownerHash: resolvedOwner.ownerHash },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          claims: {
            select: {
              id: true,
              state: true,
              result: true,
              text: true,
              normalizedText: true,
            },
          },
        },
      });

      if (realRuns.length > 0) {
        const mapped: HistoryCheckItem[] = realRuns.map((r) => {
          // Compute truth score from assessed claims if available
          let truthScore: number | null = null;
          const assessed = r.claims.filter((c) => c.state === 'assessed' && c.result);
          if (assessed.length > 0) {
            const scores = assessed
              .map((c) => {
                const res = c.result as Record<string, unknown> | null;
                return typeof res?.score === 'number' ? res.score : null;
              })
              .filter((s): s is number => s !== null);
            if (scores.length > 0) {
              truthScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            }
          }

          const rawSnippet = r.question || r.text || '';
          const titleSnippet = r.question ? r.question.slice(0, 48) : r.text.slice(0, 48);

          return {
            id: r.id,
            timestamp: r.createdAt.getTime(),
            mode: r.mode === 'ask' ? 'ask' : 'paste',
            title: titleSnippet,
            queryOrSnippet: rawSnippet.slice(0, 160),
            claimsCount: r.claims.length,
            status:
              r.state === 'COMPLETED' || r.state === 'completed'
                ? 'completed'
                : r.state === 'FAILED' || r.state === 'failed'
                ? 'failed'
                : 'running',
            reportUrl: `/report/${r.id}`,
            truthScore,
            asOfDate: (r.context as Record<string, unknown>)?.targetDate
              ? String((r.context as Record<string, unknown>).targetDate)
              : undefined,
            ipHash: ipHash.slice(0, 12),
          };
        });

        return NextResponse.json({
          success: true,
          source: 'database',
          ipHash: `${ipHash.slice(0, 10)}...`,
          checks: mapped,
        });
      }
    } catch (err) {
      console.warn('[GET /api/history] PostgreSQL query caught:', err);
    }
  }

  // 2. Fallback to in-memory store or seed demo checks
  const existing = inMemoryIpStore.get(ipHash) || SEED_HISTORY_CHECKS;

  return NextResponse.json({
    success: true,
    source: 'fallback',
    ipHash: `${ipHash.slice(0, 10)}...`,
    checks: existing,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const ipHash = hashIp(ip);

    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid check item payload' },
        { status: 400 }
      );
    }

    const item: HistoryCheckItem = {
      id: String(body.id),
      timestamp: Number(body.timestamp) || Date.now(),
      mode: body.mode === 'ask' ? 'ask' : 'paste',
      title: String(body.title || 'Untitled Verification'),
      queryOrSnippet: String(body.queryOrSnippet || '').slice(0, 200),
      claimsCount: Number(body.claimsCount) || 1,
      status: body.status || 'completed',
      reportUrl: String(body.reportUrl || `/report/${body.id}`),
      truthScore: body.truthScore !== undefined ? Number(body.truthScore) : null,
      asOfDate: body.asOfDate ? String(body.asOfDate) : undefined,
      ipHash: ipHash.slice(0, 12),
    };

    const current = inMemoryIpStore.get(ipHash) || [...SEED_HISTORY_CHECKS];
    const updated = [item, ...current.filter((c) => c.id !== item.id)].slice(0, 30);
    inMemoryIpStore.set(ipHash, updated);

    return NextResponse.json({
      success: true,
      item,
      totalCount: updated.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to record IP history' },
      { status: 500 }
    );
  }
}
