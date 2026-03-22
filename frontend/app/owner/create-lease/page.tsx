'use client';

import { useEffect, useState } from 'react';
import { parseUnits, namehash } from 'viem';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { WalletConnect } from '@/components/WalletConnect';
import { TransactionStatus } from '@/components/TransactionStatus';
import {
  LEASE_MANAGER_ADDRESS,
  NAME_WRAPPER_ADDRESS,
  leaseManagerAbi,
  nameWrapperAbi,
} from '@/lib/contracts';
import { isInjectedConnector } from '@/lib/privy';

type PageState = 'form' | 'approving' | 'creating' | 'success' | 'error';

export default function CreateLeasePage() {
  const { address, isConnected, connector } = useAccount();

  const [tenantAddress, setTenantAddress] = useState('');
  const [label, setLabel] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [penaltyBps, setPenaltyBps] = useState('50');
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdName, setCreatedName] = useState('');

  const usingInjected = isInjectedConnector(connector);
  const canManageOwnerFlow = Boolean(isConnected && address && usingInjected);

  const parentEnsName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';
  const ownerNode = ownerLabel
    ? (namehash(`${ownerLabel}.${parentEnsName}`) as `0x${string}`)
    : undefined;

  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: canManageOwnerFlow && address ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: canManageOwnerFlow },
  });

  const { writeContract: writeApproval, data: approvalTxHash, isPending: approvalPending } =
    useWriteContract();
  const { writeContract: writeCreateLease, data: createTxHash, isPending: createPending } =
    useWriteContract();

  const { isSuccess: approvalConfirmed, isLoading: approvalConfirming } =
    useWaitForTransactionReceipt({ hash: approvalTxHash });
  const { isSuccess: createConfirmed, isLoading: createConfirming } =
    useWaitForTransactionReceipt({ hash: createTxHash });

  useEffect(() => {
    if (approvalConfirmed) {
      refetchApproval();
      setPageState('form');
    }
  }, [approvalConfirmed, refetchApproval]);

  useEffect(() => {
    if (createConfirmed) {
      setPageState('success');
    }
  }, [createConfirmed]);

  function handleApproveNameWrapper() {
    if (!canManageOwnerFlow) return;
    setPageState('approving');
    setErrorMsg('');
    writeApproval(
      {
        address: NAME_WRAPPER_ADDRESS,
        abi: nameWrapperAbi,
        functionName: 'setApprovalForAll',
        args: [LEASE_MANAGER_ADDRESS, true],
      },
      {
        onError: (txError) => {
          setErrorMsg(txError.message.slice(0, 200));
          setPageState('error');
        },
      }
    );
  }

  function handleCreateLease() {
    if (!canManageOwnerFlow || !ownerNode || !tenantAddress || !label || !rentAmount || !durationMonths)
      return;

    const preview = `${label}.${ownerLabel}.${parentEnsName}`;
    setCreatedName(preview);
    setPageState('creating');
    setErrorMsg('');

    writeCreateLease(
      {
        address: LEASE_MANAGER_ADDRESS,
        abi: leaseManagerAbi,
        functionName: 'createLease',
        args: [
          ownerNode,
          label,
          tenantAddress as `0x${string}`,
          parseUnits(rentAmount, 6),
          BigInt(durationMonths),
          BigInt(penaltyBps),
        ],
        gas: 600000n,
      },
      {
        onError: (txError) => {
          setErrorMsg(txError.message.slice(0, 200));
          setPageState('error');
        },
      }
    );
  }

  if (!canManageOwnerFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg p-4">
        <WalletConnect
          role="owner"
          title="Create Lease"
          description="Owner flows require an injected wallet (MetaMask). Email-only sessions are blocked."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Lease</h1>
          <p className="text-sm text-gray-500 mt-1">Mint a three-tier ENS lease subname</p>
        </div>

        {isApproved === false && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 mb-3">
              Approve LeaseManager on NameWrapper before creating leases.
            </p>
            <button
              onClick={handleApproveNameWrapper}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
            >
              Approve LeaseManager
            </button>
          </div>
        )}

        {pageState === 'approving' && (
          <TransactionStatus
            isPending={approvalPending}
            isConfirming={approvalConfirming}
            confirmingText="Confirming NameWrapper approval..."
          />
        )}

        {pageState === 'creating' && (
          <TransactionStatus
            isPending={createPending}
            isConfirming={createConfirming}
            pendingText="Confirm in wallet..."
            confirmingText="Creating lease on-chain..."
          />
        )}

        {pageState === 'form' && isApproved !== false && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Address</label>
              <input
                type="text"
                value={tenantAddress}
                onChange={(e) => setTenantAddress(e.target.value)}
                placeholder="0x..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner ENS Label</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ownerLabel}
                  onChange={(e) =>
                    setOwnerLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  placeholder="dupont"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">.{parentEnsName}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lease Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) =>
                  setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="apt1"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Rent (USDC)
              </label>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                placeholder="1500"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (months)
                </label>
                <input
                  type="number"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  min="1"
                  max="120"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Penalty (bps/day)
                </label>
                <input
                  type="number"
                  value={penaltyBps}
                  onChange={(e) => setPenaltyBps(e.target.value)}
                  min="0"
                  max="1000"
                  placeholder="50"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleCreateLease}
              disabled={!tenantAddress || !label || !ownerLabel || !rentAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Create Lease
            </button>
          </div>
        )}

        {pageState === 'success' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">✓</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Lease Created</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-gray-500">ENS Subname</p>
              <p className="font-mono text-blue-600 font-semibold break-all">{createdName}</p>
              {createTxHash && (
                <p className="text-xs text-gray-400 break-all">
                  Tx: {createTxHash.slice(0, 10)}...{createTxHash.slice(-8)}
                </p>
              )}
            </div>
            <a
              href="/owner/dashboard"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
            >
              Back to Dashboard
            </a>
          </div>
        )}

        {pageState === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-4xl mb-2">✗</div>
            <p className="font-semibold text-red-700 mb-1">Transaction Failed</p>
            <p className="text-sm text-gray-500 mb-3 break-all">{errorMsg}</p>
            <button
              onClick={() => setPageState('form')}
              className="text-blue-600 hover:underline text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/owner/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
