'use client';

import { useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatUnits } from 'viem';
import { LeaseCard } from '@/components/LeaseCard';
import { WalletConnect } from '@/components/WalletConnect';
import { LEASE_MANAGER_ADDRESS, MOCK_USDC_ADDRESS, leaseManagerAbi, mockUsdcAbi } from '@/lib/contracts';
import { useENSProfile } from '@/hooks/useENSProfile';

export default function TenantDashboardPage() {
  const { address, isConnected } = useAccount();

  const { data: tenantLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTenantLeases',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract: writeMint, data: mintTxHash, isPending: mintPending } = useWriteContract();
  const { isSuccess: mintConfirmed, isLoading: mintConfirming } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  useEffect(() => {
    if (mintConfirmed) refetchBalance();
  }, [mintConfirmed, refetchBalance]);

  function handleMintUSDC() {
    if (!address) return;
    writeMint({
      address: MOCK_USDC_ADDRESS,
      abi: mockUsdcAbi,
      functionName: 'mint',
      args: [address, 10000n * 10n ** 6n],
    });
  }

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg p-4">
        <WalletConnect
          role="tenant"
          title="Tenant Dashboard"
          description="Connect with email to view your leases and payment links."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tenant Dashboard</h1>
          <p className="text-sm text-gray-500">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">USDC Balance</p>
            <p className="text-lg font-bold">
              {usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : '...'} USDC
            </p>
          </div>
          <button
            onClick={handleMintUSDC}
            disabled={mintPending || mintConfirming}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            {mintPending ? 'Confirm...' : mintConfirming ? 'Minting...' : 'Mint 10,000 USDC'}
          </button>
        </div>

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

        <div className="mt-8 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">
            &larr; Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

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

  const { data: paymentHistory } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getPaymentHistory',
    args: [leaseId],
  });

  const lease = leaseData as
    | {
        parentNode: `0x${string}`;
        label: string;
        rentAmount: bigint;
        nextDueDate: bigint;
        endDate: bigint;
        accruedPenalty: bigint;
        active: boolean;
      }
    | undefined;

  const ensProfile = useENSProfile({
    leaseSeed:
      lease && lease.parentNode
        ? {
            parentNode: lease.parentNode,
            label: lease.label,
          }
        : undefined,
    enabled: !!lease,
  });

  if (!lease) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  const nextDueDate = new Date(Number(lease.nextDueDate) * 1000);
  const endDate = new Date(Number(lease.endDate) * 1000);
  const livePenalty = (currentPenalty as bigint | undefined) ?? 0n;
  const penalty = livePenalty + lease.accruedPenalty;
  const overdue = Date.now() > Number(lease.nextDueDate) * 1000;
  const status = !lease.active ? 'terminated' : overdue ? 'overdue' : 'active';
  const paymentCount = paymentHistory ? (paymentHistory as [bigint[], bigint[]])[0].length : 0;

  return (
    <>
      {ensProfile.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          Lease #{leaseId.toString()}: {ensProfile.error}
        </div>
      )}

      <LeaseCard
        ensName={ensProfile.ensName || `UNRESOLVED.${lease.label}`}
        leaseId={leaseId}
        rentAmount={lease.rentAmount}
        nextDueDate={nextDueDate}
        endDate={endDate}
        totalDue={totalDue as bigint | undefined}
        penalty={penalty}
        paymentCount={paymentCount}
        status={status}
        personaVerified={ensProfile.personaVerified}
        primaryLink={
          ensProfile.ensName
            ? {
                label: 'Pay Rent',
                href: `/pay/${ensProfile.ensName}`,
              }
            : undefined
        }
      />
    </>
  );
}

