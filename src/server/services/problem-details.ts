import { NextResponse } from 'next/server';

export interface ProblemDetailsOptions {
  status: number;
  code: string;
  title: string;
  detail: string;
  instance: string;
  issues?: unknown[];
}

/**
 * Creates an RFC 7807 compliant Problem Details HTTP response.
 * Also preserves a top-level `error` string field for backward compatibility with simple API clients.
 */
export function problemResponse(options: ProblemDetailsOptions): NextResponse {
  const { status, code, title, detail, instance, issues } = options;

  return NextResponse.json(
    {
      type: `https://afterfact.dev/errors/${code}`,
      title,
      status,
      detail,
      instance,
      code,
      error: detail,
      ...(issues ? { issues } : {}),
    },
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
