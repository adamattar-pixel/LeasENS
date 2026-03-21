'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import {
  LEASE_MANAGER_ADDRESS,
  MOCK_USDC_ADDRESS,
  leaseManagerAbi,
  mockUsdcAbi,
} from '@/lib/contracts';

type TxStage = 'idle' | 'minting' | 'approving' | 'paying' | 'success' | 'error';

export function usePayRent({
  leaseId,
  totalDue,
}: {
  leaseId: bigint | null;
  totalDue: bigint | undefined;
}) {
  const { address } = useAccount();
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<string>('');

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'allowance',
    args: address ? [address, LEASE_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: writeMint,
    data: mintTxHash,
    isPending: mintPending,
  } = useWriteContract();

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: approvePending,
  } = useWriteContract();

  const {
    writeContract: writePayRent,
    data: payTxHash,
    isPending: payPending,
  } = useWriteContract();

  const { isLoading: mintConfirming, isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const { isLoading: payConfirming, isSuccess: payConfirmed } = useWaitForTransactionReceipt({
    hash: payTxHash,
  });

  useEffect(() => {
    if (mintConfirmed) {
      setStage('idle');
      refetchBalance();
    }
  }, [mintConfirmed, refetchBalance]);

  useEffect(() => {
    if (approveConfirmed) {
      refetchAllowance();
      setStage('idle');
    }
  }, [approveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (payConfirmed) {
      setStage('success');
      refetchAllowance();
      refetchBalance();
    }
  }, [payConfirmed, refetchAllowance, refetchBalance]);

  function mintTestUsdc() {
    if (!address) return;
    setError('');
    setStage('minting');
    writeMint(
      {
        address: MOCK_USDC_ADDRESS,
        abi: mockUsdcAbi,
        functionName: 'mint',
        args: [address, 10000n * 10n ** 6n],
      },
      {
        onError: (txError) => {
          setError(txError.message);
          setStage('error');
        },
      }
    );
  }

  function approve() {
    if (!totalDue) return;
    setError('');
    setStage('approving');
    writeApprove(
      {
        address: MOCK_USDC_ADDRESS,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [LEASE_MANAGER_ADDRESS, totalDue],
      },
      {
        onError: (txError) => {
          setError(txError.message);
          setStage('error');
        },
      }
    );
  }

  function pay() {
    if (leaseId === null) return;
    setError('');
    setStage('paying');
    writePayRent(
      {
        address: LEASE_MANAGER_ADDRESS,
        abi: leaseManagerAbi,
        functionName: 'payRent',
        args: [leaseId],
      },
      {
        onError: (txError) => {
          setError(txError.message);
          setStage('error');
        },
      }
    );
  }

  function approveAndPay() {
    if (!totalDue) return;
    const approvedAmount = (allowance as bigint | undefined) ?? 0n;
    if (approvedAmount < totalDue) {
      approve();
      return;
    }
    pay();
  }

  const minting = stage === 'minting' || mintPending || mintConfirming;
  const approving = stage === 'approving' || approvePending || approveConfirming;
  const paying = stage === 'paying' || payPending || payConfirming;
  const canAfford = useMemo(() => {
    if (!totalDue) return false;
    return ((balance as bigint | undefined) ?? 0n) >= totalDue;
  }, [balance, totalDue]);

  return {
    allowance: allowance as bigint | undefined,
    balance: balance as bigint | undefined,
    mintTxHash,
    approveTxHash,
    payTxHash,
    minting,
    approving,
    paying,
    stage,
    error,
    canAfford,
    mintTestUsdc,
    approve,
    pay,
    approveAndPay,
    resetError: () => {
      setError('');
      if (stage === 'error') setStage('idle');
    },
    refresh: () => {
      refetchAllowance();
      refetchBalance();
    },
  };
}

