'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { subnameExists, getLeaseRecords } from '@/lib/ens';
import {
  LEASE_MANAGER_ADDRESS,
  MOCK_USDC_ADDRESS,
  leaseManagerAbi,
  mockUsdcAbi,
} from '@/lib/contracts';

type LeaseRecords = {
  status: string | null;
  tenant: string | null;
  rentAmount: string | null;
  startDate: string | null;
  endDate: string | null;
  personaVerified: string | null;
};

type PageState = 'loading' | 'invalid' | 'no-wallet' | 'ready' | 'approving' | 'paying' | 'success' | 'error';

export default function PayPage() {
  const params = useParams();
  const ensName = decodeURIComponent(params.ensName as string);
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [leaseRecords, setLeaseRecords] = useState<LeaseRecords | null>(null);
  const [leaseId, setLeaseId] = useState<bigint | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Find lease ID by scanning leases for matching tenant ─────
  const { data: leaseCount } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'leaseCount',
  });

  // ─── Read lease data once we have a leaseId ───────────────────
  const { data: leaseData, refetch: refetchLease } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getLease',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  // ─── Get total due (rent + penalty) ───────────────────────────
  const { data: totalDue, refetch: refetchTotalDue } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTotalDue',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  // ─── Get current penalty ──────────────────────────────────────
  const { data: currentPenalty } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'calculatePenalty',
    args: leaseId !== null ? [leaseId] : undefined,
    query: { enabled: leaseId !== null },
  });

  // ─── Check USDC allowance ─────────────────────────────────────
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'allowance',
    args: address ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // ─── Check USDC balance ───────────────────────────────────────
  const { data: usdcBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // ─── Write contracts ──────────────────────────────────────────
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: approveIsPending,
  } = useWriteContract();

  const {
    writeContract: writePayRent,
    data: payTxHash,
    isPending: payIsPending,
  } = useWriteContract();

  const { isLoading: approveIsConfirming, isSuccess: approveIsConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const { isLoading: payIsConfirming, isSuccess: payIsConfirmed } =
    useWaitForTransactionReceipt({ hash: payTxHash });

  // ─── Step 1: Validate ENS name and fetch lease records ────────
  useEffect(() => {
    async function validate() {
      try {
        const exists = await subnameExists(ensName);
        if (!exists) {
          setPageState('invalid');
          return;
        }
        const records = await getLeaseRecords(ensName);
        if (!records.status || records.status !== 'active') {
          setPageState('invalid');
          return;
        }
        setLeaseRecords(records);
      } catch {
        setPageState('invalid');
      }
    }
    validate();
  }, [ensName]);

  // ─── Step 2: Set leaseId (for demo, first lease; in production, use indexer) ──
  useEffect(() => {
    if (leaseRecords && leaseCount !== undefined) {
      // For the demo, the lease ID can be determined from the URL or set to 0
      // In production, you'd look this up via an indexer
      setLeaseId(BigInt(0));
    }
  }, [leaseRecords, leaseCount]);

  // ─── Step 3: Set page state based on wallet connection ────────
  useEffect(() => {
    if (!leaseRecords) return;
    if (!privyReady) return;
    if (!authenticated || !isConnected) {
      setPageState('no-wallet');
      return;
    }
    setPageState('ready');
  }, [leaseRecords, privyReady, authenticated, isConnected]);

  // ─── Step 4: Handle approval confirmation → trigger payRent ───
  useEffect(() => {
    if (approveIsConfirmed && pageState === 'approving') {
      refetchAllowance();
      handlePayRent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveIsConfirmed]);

  // ─── Step 5: Handle pay confirmation ──────────────────────────
  useEffect(() => {
    if (payIsConfirmed) {
      setPageState('success');
      refetchLease();
      refetchTotalDue();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payIsConfirmed]);

  // ─── Actions ──────────────────────────────────────────────────
  function handleApproveAndPay() {
    if (!totalDue || leaseId === null) return;

    const needsApproval = !allowance || allowance < totalDue;

    if (needsApproval) {
      setPageState('approving');
      writeApprove({
        address: MOCK_USDC_ADDRESS,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [LEASE_MANAGER_ADDRESS, totalDue],
      }, {
        onError: (err) => {
          setErrorMsg(err.message);
          setPageState('error');
        },
      });
    } else {
      handlePayRent();
    }
  }

  function handlePayRent() {
    if (leaseId === null) return;
    setPageState('paying');
    writePayRent({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'payRent',
      args: [leaseId],
    }, {
      onError: (err) => {
        setErrorMsg(err.message);
        setPageState('error');
      },
    });
  }

  // ─── Derived values ───────────────────────────────────────────
  const rentAmount = leaseRecords?.rentAmount ? BigInt(leaseRecords.rentAmount) : BigInt(0);
  const penalty = currentPenalty ?? BigInt(0);
  const accruedPenalty = leaseData ? (leaseData as { accruedPenalty: bigint }).accruedPenalty : BigInt(0);
  const total = totalDue ?? BigInt(0);
  const isLate = penalty > BigInt(0) || accruedPenalty > BigInt(0);
  const hasBalance = usdcBalance !== undefined && total > BigInt(0) && usdcBalance >= total;

  const nextDueDate = leaseData
    ? new Date(Number((leaseData as { nextDueDate: bigint }).nextDueDate) * 1000)
    : null;

  const endDate = leaseRecords?.endDate
    ? new Date(Number(leaseRecords.endDate) * 1000)
    : null;

  // ─── Render ───────────────────────────────────────────────────
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
          <div className="text-red-500 text-5xl mb-4">&#x2718;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Payment Link</h1>
          <p className="text-gray-600 mb-1">
            The ENS name <span className="font-mono font-semibold">{ensName}</span> does not exist or has no valid active lease.
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
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Pay Rent</h1>
          <p className="text-sm font-mono text-blue-600 mt-1">{ensName}</p>
          {leaseRecords?.personaVerified === 'true' && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              &#x2713; Identity Verified
            </span>
          )}
        </div>

        {/* Lease Details */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Monthly Rent</span>
            <span className="font-semibold">{formatUnits(rentAmount, 6)} USDC</span>
          </div>

          {isLate && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-red-500">Late Penalty</span>
                <span className="font-semibold text-red-600">
                  +{formatUnits(penalty + accruedPenalty, 6)} USDC
                </span>
              </div>
              <div className="border-t border-red-200 my-1" />
            </>
          )}

          <div className="flex justify-between text-base font-bold">
            <span>Total Due</span>
            <span className={isLate ? 'text-red-600' : 'text-gray-900'}>
              {formatUnits(total, 6)} USDC
            </span>
          </div>

          {nextDueDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Due Date</span>
              <span className={isLate ? 'text-red-500 font-medium' : 'text-gray-700'}>
                {nextDueDate.toLocaleDateString()}
                {isLate && ' (OVERDUE)'}
              </span>
            </div>
          )}

          {endDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lease End</span>
              <span className="text-gray-700">{endDate.toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Wallet Balance */}
        {isConnected && usdcBalance !== undefined && (
          <div className="flex justify-between text-sm mb-4 px-1">
            <span className="text-gray-500">Your USDC Balance</span>
            <span className={hasBalance ? 'text-gray-700' : 'text-red-500 font-medium'}>
              {formatUnits(usdcBalance, 6)} USDC
              {!hasBalance && ' (insufficient)'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        {pageState === 'no-wallet' && (
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Connect Wallet to Pay
          </button>
        )}

        {pageState === 'ready' && (
          <button
            onClick={handleApproveAndPay}
            disabled={!hasBalance || total === BigInt(0)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {!hasBalance ? 'Insufficient USDC Balance' : `Pay ${formatUnits(total, 6)} USDC`}
          </button>
        )}

        {pageState === 'approving' && (
          <div className="text-center py-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {approveIsPending ? 'Confirm approval in wallet...' : approveIsConfirming ? 'Confirming approval...' : 'Approving USDC...'}
            </p>
          </div>
        )}

        {pageState === 'paying' && (
          <div className="text-center py-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {payIsPending ? 'Confirm payment in wallet...' : payIsConfirming ? 'Confirming payment...' : 'Processing payment...'}
            </p>
          </div>
        )}

        {pageState === 'success' && (
          <div className="text-center py-3">
            <div className="text-green-500 text-4xl mb-2">&#x2714;</div>
            <p className="font-semibold text-green-700 mb-1">Payment Successful!</p>
            <p className="text-sm text-gray-500">
              Transaction: {payTxHash ? `${payTxHash.slice(0, 10)}...${payTxHash.slice(-8)}` : ''}
            </p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="text-center py-3">
            <div className="text-red-500 text-4xl mb-2">&#x2718;</div>
            <p className="font-semibold text-red-700 mb-1">Payment Failed</p>
            <p className="text-sm text-gray-500 mb-3 break-all">{errorMsg.slice(0, 200)}</p>
            <button
              onClick={() => setPageState('ready')}
              className="text-blue-600 hover:underline text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Connected address */}
        {isConnected && address && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}

        {/* Nav */}
        <div className="mt-6 text-center">
          <a href="/tenant/dashboard" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Dashboard</a>
        </div>
      </div>
    </div>
  );
}
