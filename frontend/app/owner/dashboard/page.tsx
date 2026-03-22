'use client';

import { useEffect, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { LeaseCard } from '@/components/LeaseCard';
import { WalletConnect } from '@/components/WalletConnect';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';
import { isInjectedConnector } from '@/lib/privy';
import { useENSProfile } from '@/hooks/useENSProfile';

export default function OwnerDashboardPage() {
  const { address, isConnected, connector } = useAccount();
  const [actionLeaseId, setActionLeaseId] = useState<bigint | null>(null);
  const [actionType, setActionType] = useState<'terminate' | 'simulate' | null>(null);

  const usingInjected = isInjectedConnector(connector);
  const canManageOwnerFlow = Boolean(isConnected && address && usingInjected);

  const { data: ownerLeaseIds, refetch: refetchLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getOwnerLeases',
    args: canManageOwnerFlow ? [address] : undefined,
    query: { enabled: canManageOwnerFlow },
  });

  const { writeContract: writeTerminate, data: terminateTxHash, isPending: terminatePending } =
    useWriteContract();
  const {
    writeContract: writeSimulateLate,
    data: simulateTxHash,
    isPending: simulatePending,
  } = useWriteContract();

  const { isSuccess: terminateConfirmed } = useWaitForTransactionReceipt({ hash: terminateTxHash });
  const { isSuccess: simulateConfirmed } = useWaitForTransactionReceipt({ hash: simulateTxHash });

  useEffect(() => {
    if (terminateConfirmed || simulateConfirmed) {
      refetchLeaseIds();
      setActionLeaseId(null);
      setActionType(null);
    }
  }, [terminateConfirmed, simulateConfirmed, refetchLeaseIds]);

  function handleTerminate(leaseId: bigint) {
    const reason = window.prompt('Enter termination reason:');
    if (!reason) return;
    setActionLeaseId(leaseId);
    setActionType('terminate');
    writeTerminate({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'terminateLease',
      args: [leaseId, reason],
    });
  }

  function handleSimulateLate(leaseId: bigint) {
    setActionLeaseId(leaseId);
    setActionType('simulate');
    const fiveDaysAgo = BigInt(Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60);
    writeSimulateLate({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'setDueDateForDemo',
      args: [leaseId, fiveDaysAgo],
    });
  }

  if (!canManageOwnerFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg p-4">
        <WalletConnect
          role="owner"
          title="Owner Dashboard"
          description="Owner management requires an injected wallet. Email-only sessions are blocked."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg p-4">
      <div className="max-w-4xl mx-auto">
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

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-700">
            Strict parity mode enabled: lease links must stay in three-tier format
            (tenant.owner.parent.eth).
          </p>
        </div>

        {ownerLeaseIds && ownerLeaseIds.length > 0 ? (
          <div className="space-y-4">
            {ownerLeaseIds.map((leaseId) => (
              <OwnerLeaseCard
                key={leaseId.toString()}
                leaseId={leaseId}
                actionLeaseId={actionLeaseId}
                actionType={actionType}
                actionPending={terminatePending || simulatePending}
                onTerminate={handleTerminate}
                onSimulateLate={handleSimulateLate}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 mb-4">No active leases found.</p>
            <a href="/owner/create-lease" className="text-blue-600 hover:underline text-sm">
              Create your first lease
            </a>
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

function OwnerLeaseCard({
  leaseId,
  actionLeaseId,
  actionType,
  actionPending,
  onTerminate,
  onSimulateLate,
}: {
  leaseId: bigint;
  actionLeaseId: bigint | null;
  actionType: 'terminate' | 'simulate' | null;
  actionPending: boolean;
  onTerminate: (leaseId: bigint) => void;
  onSimulateLate: (leaseId: bigint) => void;
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
        tenant: string;
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
  const isActioning = actionLeaseId === leaseId && actionPending;

  const actionButtons = lease.active
    ? [
        {
          label: isActioning && actionType === 'simulate' ? 'Setting...' : 'Simulate Late',
          onClick: () => onSimulateLate(leaseId),
          variant: 'warning' as const,
          disabled: isActioning,
        },
        {
          label: isActioning && actionType === 'terminate' ? 'Terminating...' : 'Terminate',
          onClick: () => onTerminate(leaseId),
          variant: 'danger' as const,
          disabled: isActioning,
        },
      ]
    : [];

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
        tenantAddress={lease.tenant}
        rentAmount={lease.rentAmount}
        nextDueDate={nextDueDate}
        endDate={endDate}
        totalDue={totalDue as bigint | undefined}
        penalty={penalty}
        paymentCount={paymentCount}
        status={status}
        primaryLink={
          ensProfile.ensName
            ? {
                label: 'Payment Link',
                href: `/pay/${ensProfile.ensName}`,
              }
            : undefined
        }
        secondaryLink={
          ensProfile.ensName
            ? {
                label: 'QR Code',
                href: `/api/qr/${ensProfile.ensName}`,
              }
            : undefined
        }
        actions={actionButtons}
      />
    </>
  );
}
