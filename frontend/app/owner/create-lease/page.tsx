'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, namehash } from 'viem';
import {
  LEASE_MANAGER_ADDRESS,
  NAME_WRAPPER_ADDRESS,
  leaseManagerAbi,
  nameWrapperAbi,
} from '@/lib/contracts';

type PageState = 'form' | 'approving' | 'creating' | 'success' | 'error';

export default function CreateLeasePage() {
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();

  const [tenantAddress, setTenantAddress] = useState('');
  const [label, setLabel] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [penaltyBps, setPenaltyBps] = useState('50');
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdName, setCreatedName] = useState('');

  // Check if LeaseManager is approved as NameWrapper operator
  const { data: isApproved } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: address ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Approve NameWrapper
  const {
    writeContract: writeApproval,
    data: approvalTxHash,
    isPending: approvalIsPending,
  } = useWriteContract();

  const { isSuccess: approvalIsConfirmed, isLoading: approvalIsConfirming } =
    useWaitForTransactionReceipt({ hash: approvalTxHash });

  // Create lease
  const {
    writeContract: writeCreateLease,
    data: createTxHash,
    isPending: createIsPending,
  } = useWriteContract();

  const { isSuccess: createIsConfirmed, isLoading: createIsConfirming } =
    useWaitForTransactionReceipt({ hash: createTxHash });

  const parentEnsName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';
  // Compute owner node from ownerLabel (three-tier: label.ownerLabel.parentEnsName)
  const ownerNode = ownerLabel ? namehash(`${ownerLabel}.${parentEnsName}`) as `0x${string}` : undefined;

  function handleApproveNameWrapper() {
    setPageState('approving');
    writeApproval({
      address: NAME_WRAPPER_ADDRESS,
      abi: nameWrapperAbi,
      functionName: 'setApprovalForAll',
      args: [LEASE_MANAGER_ADDRESS, true],
    }, {
      onError: (err) => {
        setErrorMsg(err.message);
        setPageState('error');
      },
      onSuccess: () => {
        // Wait for confirmation then show form again
      },
    });
  }

  function handleCreateLease() {
    if (!ownerNode || !tenantAddress || !label || !rentAmount || !durationMonths) return;

    setPageState('creating');
    const rentInUSDC = parseUnits(rentAmount, 6);

    writeCreateLease({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'createLease',
      args: [
        ownerNode,
        label,
        tenantAddress as `0x${string}`,
        rentInUSDC,
        BigInt(durationMonths),
        BigInt(penaltyBps),
      ],
      gas: BigInt(600000),
    }, {
      onError: (err) => {
        setErrorMsg(err.message);
        setPageState('error');
      },
      onSuccess: () => {
        setCreatedName(`${label}.${ownerLabel}.${parentEnsName}`);
      },
    });
  }

  // Handle approval confirmation
  useEffect(() => {
    if (approvalIsConfirmed && pageState === 'approving') {
      setPageState('form');
    }
  }, [approvalIsConfirmed, pageState]);

  // Handle create confirmation
  useEffect(() => {
    if (createIsConfirmed && pageState === 'creating') {
      setPageState('success');
    }
  }, [createIsConfirmed, pageState]);

  // Not connected
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Lease</h1>
          <p className="text-gray-500 mb-6">Connect your wallet (MetaMask) to create a lease.</p>
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Lease</h1>
          <p className="text-sm text-gray-500 mt-1">Mint an ENS subname for a new tenant</p>
        </div>

        {/* NameWrapper approval check */}
        {isApproved === false && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 mb-3">
              You need to approve the LeaseManager to create subnames under your ENS name.
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
          <div className="text-center py-6 mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {approvalIsPending ? 'Confirm in wallet...' : approvalIsConfirming ? 'Confirming approval...' : 'Processing...'}
            </p>
          </div>
        )}

        {/* Form */}
        {(pageState === 'form' && isApproved !== false) && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Address</label>
              <input
                type="text"
                value={tenantAddress}
                onChange={(e) => setTenantAddress(e.target.value)}
                placeholder="0x..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Owner ENS Label</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ownerLabel}
                  onChange={(e) => setOwnerLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="dupont"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">.{parentEnsName}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">The owner subname registered by the PM (e.g. dupont)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lease Label</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="apt1"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {ownerLabel && (
                  <span className="text-sm text-gray-400 whitespace-nowrap">.{ownerLabel}.{parentEnsName}</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rent (USDC)</label>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                placeholder="1500"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
                <input
                  type="number"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  min="1"
                  max="120"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Penalty (bps/day)</label>
                <input
                  type="number"
                  value={penaltyBps}
                  onChange={(e) => setPenaltyBps(e.target.value)}
                  min="0"
                  max="1000"
                  placeholder="50"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">{Number(penaltyBps) / 100}% per day</p>
              </div>
            </div>

            {/* Preview */}
            {label && ownerLabel && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Will create:</p>
                <p className="font-mono text-blue-600 text-sm font-semibold">{label}.{ownerLabel}.{parentEnsName}</p>
              </div>
            )}

            <button
              onClick={handleCreateLease}
              disabled={!tenantAddress || !label || !ownerLabel || !rentAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Create Lease
            </button>
          </div>
        )}

        {/* Creating state */}
        {pageState === 'creating' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {createIsPending ? 'Confirm in wallet...' : createIsConfirming ? 'Creating lease on-chain...' : 'Processing...'}
            </p>
          </div>
        )}

        {/* Success state */}
        {pageState === 'success' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">&#x2714;</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Lease Created!</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-gray-500">ENS Subname</p>
              <p className="font-mono text-blue-600 font-semibold">{createdName}</p>
              {createTxHash && (
                <p className="text-xs text-gray-400">
                  Tx: {createTxHash.slice(0, 10)}...{createTxHash.slice(-8)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <a
                href="/owner/dashboard"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
              >
                Back to Dashboard
              </a>
              <button
                onClick={() => {
                  setPageState('form');
                  setTenantAddress('');
                  setLabel('');
                  setOwnerLabel('');
                  setRentAmount('');
                  setCreatedName('');
                }}
                className="block w-full text-blue-600 hover:underline text-sm py-2"
              >
                Create Another Lease
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {pageState === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-4xl mb-2">&#x2718;</div>
            <p className="font-semibold text-red-700 mb-1">Transaction Failed</p>
            <p className="text-sm text-gray-500 mb-3 break-all">{errorMsg.slice(0, 200)}</p>
            <button
              onClick={() => setPageState('form')}
              className="text-blue-600 hover:underline text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Nav */}
        <div className="mt-6 text-center">
          <a href="/owner/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
            &larr; Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
