import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/kyc/initiate
 *
 * Initiates a mock KYC verification session.
 * In production, this would create a Persona inquiry and return
 * the inquiry URL. For the demo, it returns a UUID sessionId.
 *
 * Body: { walletAddress: string, ensName: string }
 * Returns: { sessionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      );
    }

    const sessionId = randomUUID();

    return NextResponse.json({ sessionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 500 });
  }
}
