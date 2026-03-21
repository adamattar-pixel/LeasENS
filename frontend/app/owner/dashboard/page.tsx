'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';

export default function OwnerDashboardPage() {
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();
  const [actionLeaseId, setActionLeaseId] = useState<bigint | null>(null);
  const [actionType, setActionType] = useState<'terminate' | 'simulate' | null>(null);

  // Fetch owner's lease IDs
  const { data: ownerLeaseIds, refetch: refetchLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getOwnerLeases',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write contracts
  const {
    writeContract: writeTerminate,
    data: terminateTxHash,
    isPending: terminateIsPending,
  } = useWriteContract();

  const {
    writeContract: writeSimulateLate,
    data: simulateTxHash,
    isPending: simulateIsPending,
  } = useWriteContract();

  const { isSuccess: terminateIsConfirmed } = useWaitForTransactionReceipt({ hash: terminateTxHash });
  const { isSuccess: simulateIsConfirmed } = useWaitForTransactionReceipt({ hash: simulateTxHash });

  // Handle confirmed transactions
  useEffect(() => {
    if (terminateIsConfirmed || simulateIsConfirmed) {
      refetchLeaseIds();
      setActionLeaseId(null);
      setActionType(null);
    }
  }, [terminateIsConfirmed, simulateIsConfirmed, refetchLeaseIds]);

  function handleTerminate(leaseId: bigint) {
    setActionLeaseId(leaseId);
    setActionType('terminate');
    writeTerminate({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'terminateLease',
      args: [leaseId, 'Terminated by owner'],
    });
  }

  function handleSimulateLate(leaseId: bigint) {
    setActionLeaseId(leaseId);
    setActionType('simulate');
    // Set due date to 5 days ago
    const fiveDaysAgo = BigInt(Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60);
    writeSimulateLate({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'setDueDateForDemo',
      args: [leaseId, fiveDaysAgo],
    });
  }

  // Not connected state
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Owner Dashboard</h1>
          <p className="text-gray-500 mb-6">Connect your wallet to manage leases.</p>
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
            <p className="text-sm text-gray-500">
              Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <a
            href="/owner/create-lease"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
          >
            + Create Lease
          </a>
        </div>

        {/* QR Code Tip */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <span className="text-blue-600 text-sm mt-0.5">&#x1F6E1;</span>
          <p className="text-xs text-blue-700">
            Each lease has a unique payment QR code. Share it with your tenants &mdash; fake QR codes are automatically blocked by ENS verification.
          </p>
        </div>

        {/* Lease Cards */}
        {ownerLeaseIds && ownerLeaseIds.length > 0 ? (
          <div className="space-y-4">
            {ownerLeaseIds.map((leaseId) => (
              <LeaseCard
                key={leaseId.toString()}
                leaseId={leaseId}
                onTerminate={handleTerminate}
                onSimulateLate={handleSimulateLate}
                isActioning={actionLeaseId === leaseId}
                actionType={actionLeaseId === leaseId ? actionType : null}
                isPending={terminateIsPending || simulateIsPending}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 mb-4">No active leases found.</p>
            <a
              href="/owner/create-lease"
              className="text-blue-600 hover:underline text-sm"
            >
              Create your first lease
            </a>
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

// ─── Individual Lease Card Component ────────────────────────────
function LeaseCard({
  leaseId,
  onTerminate,
  onSimulateLate,
  isActioning,
  actionType,
  isPending,
}: {
  leaseId: bigint;
  onTerminate: (id: bigint) => void;
  onSimulateLate: (id: bigint) => void;
  isActioning: boolean;
  actionType: 'terminate' | 'simulate' | null;
  isPending: boolean;
}) {
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

  const getStatus = () => {
    if (!lease.active) return { label: 'Terminated', color: 'bg-red-100 text-red-700' };
    if (isLate) return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
    return { label: 'Active', color: 'bg-green-100 text-green-700' };
  };
  const status = getStatus();

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-blue-600 font-semibold">{ensSubname}</p>
          <p className="text-xs text-gray-400 mt-1">Lease #{leaseId.toString()}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Tenant</span>
          <span className="font-mono text-xs">{lease.tenant.slice(0, 6)}...{lease.tenant.slice(-4)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Rent Amount</span>
          <span className="font-semibold">{formatUnits(lease.rentAmount, 6)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Due Date</span>
          <span className={isLate ? 'text-red-500 font-medium' : 'text-gray-700'}>
            {nextDueDate.toLocaleDateString()}
            {isLate && ' (OVERDUE)'}
          </span>
        </div>
        {penalty > BigInt(0) && (
          <div className="flex justify-between text-sm">
            <span className="text-red-500">Penalty</span>
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

      {/* Payment & QR links */}
      {lease.active && (
        <div className="flex gap-3 mb-3">
          <a
            href={`/pay/${ensSubname}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-xl transition-colors text-sm text-center"
          >
            Payment Link
          </a>
          <a
            href={`/api/qr/${ensSubname}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-3 rounded-xl transition-colors text-sm text-center"
          >
            QR Code
          </a>
        </div>
      )}

      {/* Action Buttons */}
      {lease.active && (
        <div className="flex gap-3">
          <button
            onClick={() => onSimulateLate(leaseId)}
            disabled={isPending && isActioning}
            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-xl transition-colors text-sm"
          >
            {isActioning && actionType === 'simulate' ? 'Setting...' : 'Simulate Late'}
          </button>
          <button
            onClick={() => onTerminate(leaseId)}
            disabled={isPending && isActioning}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-xl transition-colors text-sm"
          >
            {isActioning && actionType === 'terminate' ? 'Terminating...' : 'Terminate'}
          </button>
        </div>
      )}
    </div>
  );
}

