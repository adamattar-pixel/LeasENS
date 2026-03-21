'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReadContract } from 'wagmi';
import { getLeaseRecords } from '@/lib/ens';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';
import type { LeaseRecords } from '@/types';

type LeaseSeed = {
  parentNode: `0x${string}`;
  label: string;
};

export function useENSProfile({
  ensName,
  leaseSeed,
  enabled = true,
}: {
  ensName?: string;
  leaseSeed?: LeaseSeed;
  enabled?: boolean;
}) {
  const [records, setRecords] = useState<LeaseRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';
  const leaseParentNode = leaseSeed?.parentNode;
  const leaseLabel = leaseSeed?.label;

  const { data: ownerLabel } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'ownerLabels',
    args: leaseParentNode ? [leaseParentNode] : undefined,
    query: { enabled: enabled && !!leaseParentNode },
  });

  const resolvedEnsName = useMemo(() => {
    if (!enabled) return null;
    if (ensName) return ensName;
    if (!leaseParentNode || !leaseLabel) return null;
    if (!ownerLabel) return null;
    return `${leaseLabel}.${ownerLabel}.${parentName}`;
  }, [enabled, ensName, leaseParentNode, leaseLabel, ownerLabel, parentName]);

  useEffect(() => {
    if (!enabled) {
      setRecords(null);
      setError(null);
      return;
    }

    if (leaseParentNode && leaseLabel && !ownerLabel && !ensName) {
      setRecords(null);
      setError('Owner label missing for lease parent node. Cannot build strict three-tier ENS name.');
      return;
    }

    if (!resolvedEnsName) {
      setRecords(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    getLeaseRecords(resolvedEnsName)
      .then((nextRecords) => {
        if (!alive) return;
        setRecords(nextRecords);
      })
      .catch(() => {
        if (!alive) return;
        setError(`Failed to load ENS text records for ${resolvedEnsName}`);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled, ensName, leaseParentNode, leaseLabel, ownerLabel, resolvedEnsName]);

  return {
    ensName: resolvedEnsName,
    ownerLabel: ownerLabel as string | undefined,
    records,
    personaVerified: records?.personaVerified === 'true',
    loading,
    error,
  };
}
