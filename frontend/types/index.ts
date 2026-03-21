export interface Lease {
  parentNode: `0x${string}`;
  leaseNode: `0x${string}`;
  label: string;
  owner: `0x${string}`;
  tenant: `0x${string}`;
  rentAmount: bigint;
  startDate: bigint;
  endDate: bigint;
  nextDueDate: bigint;
  penaltyBps: bigint;
  accruedPenalty: bigint;
  active: boolean;
}

export interface LeaseRecords {
  status: string | null;
  tenant: string | null;
  rentAmount: string | null;
  startDate: string | null;
  endDate: string | null;
  personaVerified: string | null;
  lastPaid: string | null;
  personaTimestamp: string | null;
}
