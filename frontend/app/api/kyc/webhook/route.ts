import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/kyc/webhook
 *
 * Mock KYC verification webhook.
 *
 * In production, this would:
 * 1. Receive a Persona webhook confirming identity verification
 * 2. Call leaseManager.setPersonaVerified(namehash(ensName)) using BACKEND_WALLET_PRIVATE_KEY
 * 3. Write persona.verified=true + persona.timestamp to the ENS text record
 *
 * The deployed contract does not include setPersonaVerified() — KYC is mocked
 * on the frontend (2s delay → verified badge). This route exists to demonstrate
 * the intended architecture for the hackathon judges.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ensName } = body;

    if (!ensName) {
      return NextResponse.json({ error: 'ensName is required' }, { status: 400 });
    }

    // In production with a contract that has setPersonaVerified():
    //
    // import { createWalletClient, http, namehash } from 'viem';
    // import { sepolia } from 'viem/chains';
    // import { privateKeyToAccount } from 'viem/accounts';
    //
    // const account = privateKeyToAccount(process.env.BACKEND_WALLET_PRIVATE_KEY);
    // const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
    // const node = namehash(ensName);
    // const txHash = await wallet.writeContract({
    //   address: LEASE_MANAGER_ADDRESS,
    //   abi: leaseManagerAbi,
    //   functionName: 'setPersonaVerified',
    //   args: [node],
    // });
    //
    // return NextResponse.json({ success: true, txHash });

    // Mock response — persona.verified is shown via frontend state
    return NextResponse.json({
      success: true,
      ensName,
      verified: true,
      note: 'Mock KYC — setPersonaVerified() not on deployed contract. Verification shown via frontend state.',
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
