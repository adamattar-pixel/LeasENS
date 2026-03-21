import { useReadContract } from 'wagmi';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';
import type { Lease } from '@/types';

export function useLease(leaseId: bigint) {
  const { data: leaseData, isLoading: leaseLoading } = useReadContract({
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

  const { data: ownerLabel } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'ownerLabels',
    args: leaseData ? [(leaseData as Lease).parentNode] : undefined,
    query: { enabled: !!leaseData },
  });

  return {
    lease: leaseData as Lease | undefined,
    totalDue: totalDue as bigint | undefined,
    penalty: currentPenalty as bigint | undefined,
    paymentHistory: paymentHistory as [bigint[], bigint[]] | undefined,
    ownerLabel: ownerLabel as string | undefined,
    isLoading: leaseLoading,
  };
}
