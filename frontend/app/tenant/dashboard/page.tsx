'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import {
  LEASE_MANAGER_ADDRESS,
  MOCK_USDC_ADDRESS,
  leaseManagerAbi,
  mockUsdcAbi,
} from '@/lib/contracts';

export default function TenantDashboardPage() {
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();

  // Fetch tenant's lease IDs
  const { data: tenantLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTenantLeases',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Mint test USDC
  const {
    writeContract: writeMint,
    data: mintTxHash,
    isPending: mintIsPending,
  } = useWriteContract();

  const { isSuccess: mintIsConfirmed, isLoading: mintIsConfirming } =
    useWaitForTransactionReceipt({ hash: mintTxHash });

  if (mintIsConfirmed) {
    refetchBalance();
  }

  function handleMintUSDC() {
    if (!address) return;
    writeMint({
      address: MOCK_USDC_ADDRESS,
      abi: mockUsdcAbi,
      functionName: 'mint',
      args: [address, BigInt(10000) * BigInt(10 ** 6)], // 10,000 USDC
    });
  }

  if (!privyReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!authenticated || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tenant Dashboard</h1>
          <p className="text-gray-500 mb-6">Connect your wallet to view your lease.</p>
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tenant Dashboard</h1>
          <p className="text-sm text-gray-500">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* USDC Balance + Mint */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">USDC Balance</p>
            <p className="text-lg font-bold">
              {usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : '...'} USDC
            </p>
          </div>
          <button
            onClick={handleMintUSDC}
            disabled={mintIsPending || mintIsConfirming}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            {mintIsPending ? 'Confirm...' : mintIsConfirming ? 'Minting...' : 'Mint 10,000 USDC'}
          </button>
        </div>

        {/* Lease Cards */}
        {tenantLeaseIds && tenantLeaseIds.length > 0 ? (
          <div className="space-y-4">
            {tenantLeaseIds.map((leaseId) => (
              <TenantLeaseCard key={leaseId.toString()} leaseId={leaseId} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 mb-2">No active leases found for your wallet.</p>
            <p className="text-xs text-gray-400">Ask your property owner to create a lease for your address.</p>
          </div>
        )}

        {/* Nav */}
        <div className="mt-8 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Lease Card ──────────────────────────────────────────
function TenantLeaseCard({ leaseId }: { leaseId: bigint }) {
  const { data: leaseData } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getLease',
    args: [leaseId],
  });

  const { data: totalDue } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTotalDue',
    args: [leaseId],
  });

  const { data: currentPenalty } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'calculatePenalty',
    args: [leaseId],
  });

  if (!leaseData) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  const lease = leaseData as {
    parentNode: string;
    leaseNode: string;
    label: string;
    owner: string;
    tenant: string;
    rentAmount: bigint;
    startDate: bigint;
    endDate: bigint;
    nextDueDate: bigint;
    penaltyBps: bigint;
    accruedPenalty: bigint;
    active: boolean;
  };

  const parentName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';
  const ensSubname = `${lease.label}.${parentName}`;
  const nextDueDate = new Date(Number(lease.nextDueDate) * 1000);
  const endDate = new Date(Number(lease.endDate) * 1000);
  const now = Date.now();
  const isLate = now > Number(lease.nextDueDate) * 1000;
  const penalty = (currentPenalty ?? BigInt(0)) + lease.accruedPenalty;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-blue-600 font-semibold">{ensSubname}</p>
          <p className="text-xs text-gray-400 mt-1">Lease #{leaseId.toString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Persona verified badge - always show in tenant dashboard for active leases */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            &#x2713; Verified
          </span>
          {isLate && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Overdue
            </span>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly Rent</span>
          <span className="font-semibold">{formatUnits(lease.rentAmount, 6)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Next Due Date</span>
          <span className={isLate ? 'text-red-500 font-medium' : 'text-gray-700'}>
            {nextDueDate.toLocaleDateString()}
            {isLate && ' (OVERDUE)'}
          </span>
        </div>
        {penalty > BigInt(0) && (
          <div className="flex justify-between text-sm">
            <span className="text-red-500">Late Penalty</span>
            <span className="font-semibold text-red-600">+{formatUnits(penalty, 6)} USDC</span>
          </div>
        )}
        {totalDue !== undefined && (
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
            <span>Total Due</span>
            <span className={isLate ? 'text-red-600' : ''}>{formatUnits(totalDue, 6)} USDC</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lease End</span>
          <span className="text-gray-700">{endDate.toLocaleDateString()}</span>
        </div>
      </div>

      {/* Pay Rent link */}
      <a
        href={`/pay/${ensSubname}`}
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
      >
        Pay Rent
      </a>
    </div>
  );
}
