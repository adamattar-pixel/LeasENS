'use client';

import { useEffect, useState } from 'react';
import { getLeaseRecords, getOwnerLabelFromParentNode } from '@/lib/ens';
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
  const [resolvedEnsName, setResolvedEnsName] = useState<string | null>(ensName ?? null);
  const [ownerLabel, setOwnerLabel] = useState<string | undefined>(undefined);
  const [records, setRecords] = useState<LeaseRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';

  useEffect(() => {
    if (!enabled) {
      setResolvedEnsName(ensName ?? null);
      setOwnerLabel(undefined);
      setRecords(null);
      setError(null);
      return;
    }

    // If a direct ensName was given, use it
    if (ensName) {
      setResolvedEnsName(ensName);
      return;
    }

    // If no leaseSeed, nothing to resolve
    if (!leaseSeed?.parentNode || !leaseSeed?.label) {
      setResolvedEnsName(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setResolvedEnsName(null);

    getOwnerLabelFromParentNode(leaseSeed.parentNode)
      .then((label) => {
        if (!alive) return;
        if (!label) {
          setError('Owner label missing for lease parent node. Cannot build strict three-tier ENS name.');
          setLoading(false);
          return;
        }
        setOwnerLabel(label);
        const name = `${leaseSeed.label}.${label}.${parentName}`;
        setResolvedEnsName(name);
      })
      .catch(() => {
        if (!alive) return;
        setError('Failed to resolve owner label from ENS.');
        setLoading(false);
      });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ensName, leaseSeed?.parentNode, leaseSeed?.label, parentName]);

  useEffect(() => {
    if (!enabled || !resolvedEnsName) {
      if (!resolvedEnsName) setRecords(null);
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

    return () => { alive = false; };
  }, [enabled, resolvedEnsName]);

  return {
    ensName: resolvedEnsName,
    ownerLabel,
    records,
    personaVerified: records?.personaVerified === 'true',
    loading,
    error,
  };
}
