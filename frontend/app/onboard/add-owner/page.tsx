'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { namehash } from 'viem';
import {
  LEASE_MANAGER_ADDRESS,
  NAME_WRAPPER_ADDRESS,
  leaseManagerAbi,
  nameWrapperAbi,
} from '@/lib/contracts';

type PageState = 'form' | 'approving-pm' | 'registering' | 'success' | 'owner-approval' | 'approving-owner' | 'done' | 'error';

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

  // Check NameWrapper approval for PM (connected wallet)
  const { data: isPMApproved, refetch: refetchPMApproval } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: address ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Check NameWrapper approval for the owner address (if connected wallet IS the owner)
  const { data: isOwnerApproved, refetch: refetchOwnerApproval } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: ownerAddress ? [ownerAddress as `0x${string}`, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!ownerAddress && ownerAddress.startsWith('0x') && ownerAddress.length === 42 },
  });

  // PM approval write
  const {
    writeContract: writePMApproval,
    data: pmApprovalTxHash,
    isPending: pmApprovalIsPending,
  } = useWriteContract();

  const { isSuccess: pmApprovalIsConfirmed, isLoading: pmApprovalIsConfirming } =
    useWaitForTransactionReceipt({ hash: pmApprovalTxHash });

  // Register owner write
  const {
    writeContract: writeRegister,
    data: registerTxHash,
    isPending: registerIsPending,
  } = useWriteContract();

  const { isSuccess: registerIsConfirmed, isLoading: registerIsConfirming } =
    useWaitForTransactionReceipt({ hash: registerTxHash });

  // Owner approval write (owner connects same page)
  const {
    writeContract: writeOwnerApproval,
    data: ownerApprovalTxHash,
    isPending: ownerApprovalIsPending,
  } = useWriteContract();

  const { isSuccess: ownerApprovalIsConfirmed, isLoading: ownerApprovalIsConfirming } =
    useWaitForTransactionReceipt({ hash: ownerApprovalTxHash });

  // Handle PM approval confirmation
  useEffect(() => {
    if (pmApprovalIsConfirmed && pageState === 'approving-pm') {
      refetchPMApproval();
      setPageState('form');
    }
  }, [pmApprovalIsConfirmed, pageState, refetchPMApproval]);

  // Handle register confirmation
  useEffect(() => {
    if (registerIsConfirmed && pageState === 'registering') {
      setPageState('success');
    }
  }, [registerIsConfirmed, pageState]);

  // Handle owner approval confirmation
  useEffect(() => {
    if (ownerApprovalIsConfirmed && pageState === 'approving-owner') {
      refetchOwnerApproval();
      setPageState('done');
    }
  }, [ownerApprovalIsConfirmed, pageState, refetchOwnerApproval]);

  function handlePMApprove() {
    setPageState('approving-pm');
    writePMApproval({
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

  function handleOwnerApprove() {
    setPageState('approving-owner');
    writeOwnerApproval({
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

        {/* PM NameWrapper approval */}
        {isPMApproved === false && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 mb-1 font-semibold">One-time setup required</p>
            <p className="text-sm text-amber-700 mb-3">
              Approve the LeaseManager contract to create subnames under your ENS name.
            </p>
            <button
              onClick={handlePMApprove}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
            >
              Approve LeaseManager
            </button>
          </div>
        )}

        {pageState === 'approving-pm' && (
          <div className="text-center py-6 mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {pmApprovalIsPending ? 'Confirm in wallet...' : pmApprovalIsConfirming ? 'Confirming approval...' : 'Processing...'}
            </p>
          </div>
        )}

        {/* Form */}
        {pageState === 'form' && isPMApproved !== false && (
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

        {/* Success — show owner approval step */}
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
              <p className="text-xs text-gray-500 mt-1">Owner Node</p>
              <p className="font-mono text-xs text-gray-400 break-all">
                {namehash(createdName)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Lease subnames will be created under this owner (e.g. apt1.{label}.{parentEnsName})
              </p>
              {registerTxHash && (
                <p className="text-xs text-gray-400">
                  Tx: {registerTxHash.slice(0, 10)}...{registerTxHash.slice(-8)}
                </p>
              )}
            </div>

            {/* Owner approval section */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm text-blue-800 font-semibold mb-1">Next: Owner must approve LeaseManager</p>
              <p className="text-sm text-blue-700 mb-3">
                The owner needs to call <span className="font-mono text-xs">setApprovalForAll</span> on the NameWrapper so the LeaseManager can create lease subnames.
              </p>

              {/* Check if the connected wallet IS the owner */}
              {address?.toLowerCase() === ownerAddress.toLowerCase() ? (
                // Same wallet — can approve directly
                isOwnerApproved ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-700 font-semibold">&#x2713; Already approved! Ready to create leases.</p>
                  </div>
                ) : (
                  <button
                    onClick={handleOwnerApprove}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
                  >
                    Approve LeaseManager (as Owner)
                  </button>
                )
              ) : (
                // Different wallet — instruct owner to do it
                <div className="space-y-2">
                  <p className="text-xs text-blue-600">
                    The owner must connect wallet <span className="font-mono">{ownerAddress.slice(0, 8)}...{ownerAddress.slice(-4)}</span> and approve from the{' '}
                    <a href="/owner/create-lease" className="underline font-semibold">Create Lease</a> page.
                  </p>
                  {isOwnerApproved === true && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-700 font-semibold">&#x2713; Owner already approved!</p>
                    </div>
                  )}
                  {isOwnerApproved === false && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                      <p className="text-xs text-amber-700">&#x26A0; Owner has not approved yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <a
                href="/owner/create-lease"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
              >
                Go to Create Lease
              </a>
              <button
                onClick={() => {
                  setPageState('form');
                  setOwnerAddress('');
                  setLabel('');
                  setCreatedName('');
                }}
                className="block w-full text-blue-600 hover:underline text-sm py-2"
              >
                Register Another Owner
              </button>
            </div>
          </div>
        )}

        {/* Approving owner */}
        {pageState === 'approving-owner' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {ownerApprovalIsPending ? 'Confirm in wallet...' : ownerApprovalIsConfirming ? 'Confirming owner approval...' : 'Processing...'}
            </p>
          </div>
        )}

        {/* Owner approved — done */}
        {pageState === 'done' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">&#x2714;</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Owner Ready!</p>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-mono text-blue-600">{createdName}</span> is registered and the LeaseManager is approved. The owner can now create leases.
            </p>
            <div className="space-y-2">
              <a
                href="/owner/create-lease"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
              >
                Go to Create Lease
              </a>
              <button
                onClick={() => {
                  setPageState('form');
                  setOwnerAddress('');
                  setLabel('');
                  setCreatedName('');
                }}
                className="block w-full text-blue-600 hover:underline text-sm py-2"
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
