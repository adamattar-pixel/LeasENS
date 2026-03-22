'use client';

import { useEffect, useState } from 'react';
import { namehash } from 'viem';
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

type PageState =
  | 'form'
  | 'approving-pm'
  | 'registering'
  | 'success'
  | 'approving-owner'
  | 'done'
  | 'error';

export default function AddOwnerPage() {
  const { address, isConnected, connector } = useAccount();

  const [ownerAddress, setOwnerAddress] = useState('');
  const [label, setLabel] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdName, setCreatedName] = useState('');

  const usingInjected = isInjectedConnector(connector);
  const canManagePmFlow = Boolean(isConnected && address && usingInjected);

  const parentNode = process.env.NEXT_PUBLIC_PARENT_NODE as `0x${string}` | undefined;
  const parentEnsName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';

  const { data: isPMApproved, refetch: refetchPMApproval } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: canManagePmFlow ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: canManagePmFlow },
  });

  const { data: isOwnerApproved, refetch: refetchOwnerApproval } = useReadContract({
    address: NAME_WRAPPER_ADDRESS,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: ownerAddress ? [ownerAddress as `0x${string}`, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: ownerAddress.startsWith('0x') && ownerAddress.length === 42 },
  });

  const { writeContract: writePMApproval, data: pmApprovalTxHash, isPending: pmApprovalPending } =
    useWriteContract();
  const { writeContract: writeRegister, data: registerTxHash, isPending: registerPending } =
    useWriteContract();
  const {
    writeContract: writeOwnerApproval,
    data: ownerApprovalTxHash,
    isPending: ownerApprovalPending,
  } = useWriteContract();

  const { isSuccess: pmApprovalConfirmed, isLoading: pmApprovalConfirming } =
    useWaitForTransactionReceipt({ hash: pmApprovalTxHash });
  const { isSuccess: registerConfirmed, isLoading: registerConfirming } = useWaitForTransactionReceipt({
    hash: registerTxHash,
  });
  const { isSuccess: ownerApprovalConfirmed, isLoading: ownerApprovalConfirming } =
    useWaitForTransactionReceipt({ hash: ownerApprovalTxHash });

  useEffect(() => {
    if (pmApprovalConfirmed && pageState === 'approving-pm') {
      refetchPMApproval();
      setPageState('form');
    }
  }, [pmApprovalConfirmed, pageState, refetchPMApproval]);

  useEffect(() => {
    if (registerConfirmed && pageState === 'registering') {
      setPageState('success');
    }
  }, [registerConfirmed, pageState]);

  useEffect(() => {
    if (ownerApprovalConfirmed && pageState === 'approving-owner') {
      refetchOwnerApproval();
      setPageState('done');
    }
  }, [ownerApprovalConfirmed, pageState, refetchOwnerApproval]);

  function handlePMApprove() {
    if (!canManagePmFlow) return;
    setPageState('approving-pm');
    setErrorMsg('');
    writePMApproval(
      {
        address: NAME_WRAPPER_ADDRESS,
        abi: nameWrapperAbi,
        functionName: 'setApprovalForAll',
        args: [LEASE_MANAGER_ADDRESS, true],
      },
      {
        onError: (txError) => {
          setErrorMsg(txError.message);
          setPageState('error');
        },
      }
    );
  }

  function handleRegister() {
    if (!parentNode || !ownerAddress || !label || !canManagePmFlow) return;
    setPageState('registering');
    setErrorMsg('');
    setCreatedName(`${label}.${parentEnsName}`);
    writeRegister(
      {
        address: LEASE_MANAGER_ADDRESS,
        abi: leaseManagerAbi,
        functionName: 'registerOwner',
        args: [parentNode, label, ownerAddress as `0x${string}`],
      },
      {
        onError: (txError) => {
          setErrorMsg(txError.message);
          setPageState('error');
        },
      }
    );
  }

  function handleOwnerApprove() {
    setPageState('approving-owner');
    setErrorMsg('');
    writeOwnerApproval(
      {
        address: NAME_WRAPPER_ADDRESS,
        abi: nameWrapperAbi,
        functionName: 'setApprovalForAll',
        args: [LEASE_MANAGER_ADDRESS, true],
      },
      {
        onError: (txError) => {
          setErrorMsg(txError.message);
          setPageState('error');
        },
      }
    );
  }

  if (!canManagePmFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg p-4">
        <WalletConnect
          role="pm"
          title="Register an Owner"
          description="PM onboarding requires an injected wallet. Email-only sessions are blocked."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Register an Owner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create owner subnames under <span className="font-mono text-blue-600">{parentEnsName}</span>
          </p>
        </div>

        {isPMApproved === false && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 mb-3">
              One-time setup: approve LeaseManager on NameWrapper from PM wallet.
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
          <TransactionStatus
            isPending={pmApprovalPending}
            isConfirming={pmApprovalConfirming}
            confirmingText="Confirming PM approval..."
          />
        )}

        {pageState === 'registering' && (
          <TransactionStatus
            isPending={registerPending}
            isConfirming={registerConfirming}
            confirmingText="Registering owner on-chain..."
          />
        )}

        {pageState === 'approving-owner' && (
          <TransactionStatus
            isPending={ownerApprovalPending}
            isConfirming={ownerApprovalConfirming}
            confirmingText="Confirming owner approval..."
          />
        )}

        {pageState === 'form' && isPMApproved !== false && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Wallet Address</label>
              <input
                type="text"
                value={ownerAddress}
                onChange={(event) => setOwnerAddress(event.target.value)}
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
                  onChange={(event) => setLabel(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="dupont"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">.{parentEnsName}</span>
              </div>
            </div>

            {label && ownerAddress && (
              <div className="page-bg rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Will create:</p>
                <p className="font-mono text-blue-600 text-sm font-semibold break-all">
                  {label}.{parentEnsName}
                </p>
                <p className="text-xs text-gray-400 break-all">Resolves to: {ownerAddress}</p>
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
              <p className="text-xs text-red-500 text-center">NEXT_PUBLIC_PARENT_NODE not set in .env.local</p>
            )}
          </div>
        )}

        {pageState === 'success' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">OK</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Owner Registered</p>
            <div className="page-bg rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-gray-500">ENS Subname</p>
              <p className="font-mono text-blue-600 font-semibold break-all">{createdName}</p>
              <p className="text-xs text-gray-500">Owner Node</p>
              <p className="font-mono text-xs text-gray-400 break-all">{namehash(createdName)}</p>
              {registerTxHash && (
                <p className="text-xs text-gray-400 break-all">
                  Tx: {registerTxHash.slice(0, 10)}...{registerTxHash.slice(-8)}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm text-blue-800 font-semibold mb-1">
                Next: Owner must approve LeaseManager
              </p>
              <p className="text-sm text-blue-700 mb-3">
                The owner wallet must call <span className="font-mono text-xs">setApprovalForAll</span>.
              </p>

              {address?.toLowerCase() === ownerAddress.toLowerCase() ? (
                isOwnerApproved ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-700 font-semibold">Owner already approved.</p>
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
                <div className="space-y-2">
                  <p className="text-xs text-blue-600 break-all">
                    Owner must connect wallet {ownerAddress} and approve from the Create Lease page.
                  </p>
                  {isOwnerApproved === true && (
                    <p className="text-xs text-green-700 font-semibold">Owner already approved.</p>
                  )}
                  {isOwnerApproved === false && (
                    <p className="text-xs text-amber-700">Owner has not approved yet.</p>
                  )}
                </div>
              )}
            </div>

            <a
              href="/owner/create-lease"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
            >
              Go to Create Lease
            </a>
          </div>
        )}

        {pageState === 'done' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-5xl mb-3">OK</div>
            <p className="font-semibold text-green-700 text-lg mb-2">Owner Ready</p>
            <p className="text-sm text-gray-500 mb-4">
              {createdName} is registered and approved. The owner can now create leases.
            </p>
            <a
              href="/owner/create-lease"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
            >
              Go to Create Lease
            </a>
          </div>
        )}

        {pageState === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-4xl mb-2">X</div>
            <p className="font-semibold text-red-700 mb-1">Transaction Failed</p>
            <p className="text-sm text-gray-500 mb-3 break-all">{errorMsg.slice(0, 200)}</p>
            <button onClick={() => setPageState('form')} className="text-blue-600 hover:underline text-sm">
              Try Again
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">
            &larr; Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

