import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';

/**
 * POST /api/kyc/webhook
 *
 * KYC verification webhook. Called after tenant completes identity verification.
 * Uses a backend wallet to call leaseManager.setPersonaVerified(node), which
 * writes persona.verified=true + persona.timestamp to the ENS text record on-chain.
 *
 * Body: { ensName: string }
 * Returns: { success: true, txHash: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ensName } = body;

    if (!ensName) {
      return NextResponse.json({ error: 'ensName is required' }, { status: 400 });
    }

    const pk = process.env.BACKEND_WALLET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: 'BACKEND_WALLET_PRIVATE_KEY not configured' }, { status: 500 });
    }

    const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org';
    const account = privateKeyToAccount(pk as `0x${string}`);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpc),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpc),
    });

    const node = namehash(ensName);

    // Call setPersonaVerified on the contract
    const txHash = await walletClient.writeContract({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'setPersonaVerified',
      args: [node],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction reverted' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ensName,
      txHash,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 500 });
  }
}
