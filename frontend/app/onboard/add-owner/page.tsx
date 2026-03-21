'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  LEASE_MANAGER_ADDRESS,
  NAME_WRAPPER_ADDRESS,
  leaseManagerAbi,
  nameWrapperAbi,
} from '@/lib/contracts';

type PageState = 'form' | 'approving' | 'registering' | 'success' | 'error';

export default function AddOwnerPage() {
  const { login, authenticated, ready: privyReady } = usePrivy();
  const { address, isConnected } = useAccount();

  const [ownerAddress, setOwnerAddress] = useState('');
  const [label, setLabel] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdName, setCreatedName] = useState('');

  const parentNode = process.env.NEXT_PUBLIC_PARENT_NODE as `0x${string}` | undefined;
  const parentEnsName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';

  // Check NameWrapper approval for PM
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
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

  // Register owner
  const {
    writeContract: writeRegister,
    data: registerTxHash,
    isPending: registerIsPending,
  } = useWriteContract();

  const { isSuccess: registerIsConfirmed, isLoading: registerIsConfirming } =
    useWaitForTransactionReceipt({ hash: registerTxHash });

  // Handle approval confirmation
  useEffect(() => {
    if (approvalIsConfirmed && pageState === 'approving') {
      refetchApproval();
      setPageState('form');
    }
  }, [approvalIsConfirmed, pageState, refetchApproval]);

  // Handle register confirmation
  useEffect(() => {
    if (registerIsConfirmed && pageState === 'registering') {
      setPageState('success');
    }
  }, [registerIsConfirmed, pageState]);

  function handleApprove() {
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
    });
  }

  function handleRegister() {
    if (!parentNode || !ownerAddress || !label) return;

    setPageState('registering');
    setCreatedName(`${label}.${parentEnsName}`);

    writeRegister({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'registerOwner',
      args: [parentNode, label, ownerAddress as `0x${string}`],
    }, {
      onError: (err) => {
        setErrorMsg(err.message);
        setPageState('error');
      },
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
          <div className="text-4xl mb-3">&#x1F3E2;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Register an Owner</h1>
          <p className="text-gray-500 mb-6">
            Connect your Property Manager wallet to register owners under your ENS domain.
          </p>
          <button
            onClick={login}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Connect Wallet
          </button>
          <div className="mt-4">
            <a href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">&#x1F3E2;</div>
          <h1 className="text-2xl font-bold text-gray-900">Register an Owner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create an ENS subname for a property owner under <span className="font-mono text-blue-600">{parentEnsName}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PM: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* NameWrapper approval */}
        {isApproved === false && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 mb-1 font-semibold">One-time setup required</p>
            <p className="text-sm text-amber-700 mb-3">
              Approve the LeaseManager contract to create subnames under your ENS name.
            </p>
            <button
              onClick={handleApprove}
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
        {pageState === 'form' && isApproved !== false && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Wallet Address</label>
              <input
                type="text"
                value={ownerAddress}
                onChange={(e) => setOwnerAddress(e.target.value)}
                placeholder="0x..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner ENS Label</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="dupont"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">.{parentEnsName}</span>
              </div>
            </div>

            {/* Preview */}
            {label && ownerAddress && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Will create:</p>
                <p className="font-mono text-blue-600 text-sm font-semibold">{label}.{parentEnsName}</p>
                <p className="text-xs text-gray-400">Resolves to: {ownerAddress.slice(0, 10)}...{ownerAddress.slice(-6)}</p>
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={!ownerAddress || !label || !parentNode}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Register Owner
            </button>

            {!parentNode && (
              <p className="text-xs text-red-500 text-center">
                NEXT_PUBLIC_PARENT_NODE not set in .env.local
              </p>
            )}
          </div>
        )}

        {/* Registering state */}
        {pageState === 'registering' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {registerIsPending ? 'Confirm in wallet...' : registerIsConfirming ? 'Registering owner on-chain...' : 'Processing...'}
            </p>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">&#x2714;</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Owner Registered!</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-gray-500">ENS Subname</p>
              <p className="font-mono text-blue-600 font-semibold">{createdName}</p>
              <p className="text-xs text-gray-400">
                Resolves to: {ownerAddress.slice(0, 10)}...{ownerAddress.slice(-6)}
              </p>
              {registerTxHash && (
                <p className="text-xs text-gray-400">
                  Tx: {registerTxHash.slice(0, 10)}...{registerTxHash.slice(-8)}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm text-blue-800 font-semibold mb-1">Next step for the owner:</p>
              <p className="text-sm text-blue-700">
                The owner must connect their wallet and approve the LeaseManager on the NameWrapper before they can create leases. They can do this from the{' '}
                <a href="/owner/create-lease" className="underline font-semibold">Create Lease</a> page.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setPageState('form');
                  setOwnerAddress('');
                  setLabel('');
                  setCreatedName('');
                }}
                className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Register Another Owner
              </button>
            </div>
          </div>
        )}

        {/* Error */}
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
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  );
}
