'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { subnameExists, getLeaseRecords, findLeaseIdByEnsName } from '@/lib/ens';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';
import { PaymentCard } from '@/components/PaymentCard';
import { WalletConnect } from '@/components/WalletConnect';
import { TransactionStatus } from '@/components/TransactionStatus';
import { usePayRent } from '@/hooks/usePayRent';
import type { LeaseRecords } from '@/types';

type PageState = 'loading' | 'invalid' | 'ready';

export default function PayPage() {
  const params = useParams();
  const rawParam = params.ensName;
  const ensName = decodeURIComponent(Array.isArray(rawParam) ? rawParam[0] : (rawParam as string));
  const { address, isConnected } = useAccount();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [records, setRecords] = useState<LeaseRecords | null>(null);
  const [leaseId, setLeaseId] = useState<bigint | null>(null);

  const { data: leaseData, refetch: refetchLease } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getLease',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  const { data: totalDue, refetch: refetchTotalDue } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTotalDue',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  const { data: currentPenalty } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'calculatePenalty',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  const payRent = usePayRent({ leaseId, totalDue: totalDue as bigint | undefined });

  useEffect(() => {
    async function validatePaymentLink() {
      try {
        const exists = await subnameExists(ensName);
        if (!exists) {
          setPageState('invalid');
          return;
        }

        const nextRecords = await getLeaseRecords(ensName);
        if (!nextRecords.status || nextRecords.status !== 'active') {
          setPageState('invalid');
          return;
        }

        const nextLeaseId = await findLeaseIdByEnsName(ensName);
        if (nextLeaseId === null) {
          setPageState('invalid');
          return;
        }

        setRecords(nextRecords);
        setLeaseId(nextLeaseId);
        setPageState('ready');
      } catch {
        setPageState('invalid');
      }
    }

    validatePaymentLink();
  }, [ensName]);

  useEffect(() => {
    if (payRent.stage === 'success') {
      refetchLease();
      refetchTotalDue();
    }
  }, [payRent.stage, refetchLease, refetchTotalDue]);

  const rentAmount = records?.rentAmount ? BigInt(records.rentAmount) : 0n;
  const accruedPenalty = leaseData ? (leaseData as { accruedPenalty: bigint }).accruedPenalty : 0n;
  const livePenalty = (currentPenalty as bigint | undefined) ?? 0n;
  const combinedPenalty = livePenalty + accruedPenalty;
  const dueAmount = (totalDue as bigint | undefined) ?? 0n;

  const nextDueDate = leaseData
    ? new Date(Number((leaseData as { nextDueDate: bigint }).nextDueDate) * 1000)
    : null;

  const endDate = records?.endDate ? new Date(Number(records.endDate) * 1000) : null;

  const hasWallet = Boolean(isConnected && address);
  const needsApproval = useMemo(() => {
    if (!dueAmount) return false;
    return (payRent.allowance ?? 0n) < dueAmount;
  }, [payRent.allowance, dueAmount]);

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Resolving {ensName}...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-red-500 text-5xl mb-4">X</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Payment Link</h1>
          <p className="text-gray-600 mb-1">
            The ENS name <span className="font-mono font-semibold break-all">{ensName}</span> does not
            exist or has no valid active lease.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            This link may be fake or the lease may have been terminated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <PaymentCard
          ensName={ensName}
          monthlyRent={rentAmount}
          penalty={combinedPenalty}
          totalDue={dueAmount}
          nextDueDate={nextDueDate}
          endDate={endDate}
          verifiedLease
          personaVerified={records?.personaVerified === 'true'}
        />

        <div className="space-y-3">
          <button
            onClick={() => payRent.mintTestUsdc()}
            disabled={!hasWallet || payRent.minting}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {payRent.minting ? 'Minting...' : 'Mint 10,000 USDC'}
          </button>

          {hasWallet ? (
            <button
              onClick={() => (needsApproval ? payRent.approve() : payRent.pay())}
              disabled={!payRent.canAfford || dueAmount === 0n || payRent.approving || payRent.paying}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {!payRent.canAfford
                ? 'Insufficient USDC Balance'
                : needsApproval
                  ? 'Approve USDC'
                  : `Pay ${Number(dueAmount) / 1e6} USDC`}
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              Connect your tenant wallet to mint USDC and pay rent.
            </div>
          )}
        </div>

        {(payRent.approving || payRent.paying || payRent.minting) && (
          <TransactionStatus
            isPending={false}
            isConfirming={true}
            pendingText="Confirm in wallet..."
            confirmingText={
              payRent.approving ? 'Confirming approval...' : payRent.paying ? 'Confirming payment...' : 'Confirming mint...'
            }
          />
        )}

        {payRent.stage === 'success' && (
          <div className="text-center py-3">
            <div className="text-green-500 text-4xl mb-2">OK</div>
            <p className="font-semibold text-green-700 mb-1">Payment Successful</p>
            {payRent.payTxHash && (
              <p className="text-sm text-gray-500 break-all">
                Tx: {payRent.payTxHash.slice(0, 10)}...{payRent.payTxHash.slice(-8)}
              </p>
            )}
          </div>
        )}

        {payRent.stage === 'error' && (
          <div className="text-center py-3">
            <div className="text-red-500 text-4xl mb-2">X</div>
            <p className="font-semibold text-red-700 mb-1">Transaction Failed</p>
            <p className="text-sm text-gray-500 mb-2 break-all">{payRent.error.slice(0, 200)}</p>
            <button onClick={payRent.resetError} className="text-blue-600 hover:underline text-sm">
              Try Again
            </button>
          </div>
        )}

        {hasWallet && address && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}

        {!hasWallet && (
          <div className="mt-5">
            <WalletConnect
              role="tenant"
              title="Connect Tenant Wallet"
              description="Use email login to open your embedded wallet for payment."
            />
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/tenant/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
            &larr; Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

