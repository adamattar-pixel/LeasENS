import { createPublicClient, http, namehash } from 'viem';
import { normalize } from 'viem/ens';
import { sepolia } from 'viem/chains';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from './contracts';



const client = createPublicClient({
  chain: {
    ...sepolia,
    contracts: {
      ...sepolia.contracts,
      ensUniversalResolver: {
        address: '0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725' as `0x${string}`,
      },
    },
  },
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
});

export async function resolveAddress(name: string) {
  return client.getEnsAddress({ name: normalize(name) });
}

export async function getTextRecord(name: string, key: string) {
  return client.getEnsText({ name: normalize(name), key });
}

export async function getLeaseRecords(name: string) {
  const [status, tenant, rentAmount, startDate, endDate, personaVerified, lastPaid, personaTimestamp] = await Promise.all([
    getTextRecord(name, 'lease.status'),
    getTextRecord(name, 'lease.tenant'),
    getTextRecord(name, 'lease.rentAmount'),
    getTextRecord(name, 'lease.startDate'),
    getTextRecord(name, 'lease.endDate'),
    getTextRecord(name, 'persona.verified'),
    getTextRecord(name, 'lease.lastPaid'),
    getTextRecord(name, 'persona.timestamp'),
  ]);
  return { status, tenant, rentAmount, startDate, endDate, personaVerified, lastPaid, personaTimestamp };
}

/**
 * Derives the owner label from a parentNode by scanning OwnerRegistered event logs
 * emitted by the LeaseManager contract. This is reliable regardless of whether the
 * owner has set a reverse ENS record.
 */
// Approximate block when LeaseManager was deployed on Sepolia — avoids scanning from genesis
const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || '7900000');

export async function getOwnerLabelFromParentNode(parentNode: `0x${string}`): Promise<string | null> {
  try {
    const ownerRegisteredAbi = leaseManagerAbi.find(
      (e) => e.type === 'event' && e.name === 'OwnerRegistered',
    ) as (typeof leaseManagerAbi)[number] & { type: 'event' };

    const logs = await client.getLogs({
      address: LEASE_MANAGER_ADDRESS,
      event: ownerRegisteredAbi,
      args: { parentNode },
      fromBlock: DEPLOY_BLOCK,
      toBlock: 'latest',
    });

    if (logs.length === 0) return null;
    const latest = logs[logs.length - 1];
    return (latest.args as { label?: string }).label ?? null;
  } catch {
    return null;
  }
}

export async function subnameExists(name: string): Promise<boolean> {
  try {
    const addr = await resolveAddress(name);
    return addr !== null;
  } catch {
    return false;
  }
}

export async function findLeaseIdByEnsName(ensName: string): Promise<bigint | null> {
  try {
    const tenantAddress = await resolveAddress(ensName);
    if (!tenantAddress) return null;

    const tenantLeaseIds = await client.readContract({
      address: LEASE_MANAGER_ADDRESS,
      abi: leaseManagerAbi,
      functionName: 'getTenantLeases',
      args: [tenantAddress],
    }) as bigint[];

    const targetNode = namehash(normalize(ensName));

    for (const id of tenantLeaseIds) {
      const lease = await client.readContract({
        address: LEASE_MANAGER_ADDRESS,
        abi: leaseManagerAbi,
        functionName: 'getLease',
        args: [id],
      }) as { leaseNode: string; active: boolean };

      if (lease.leaseNode === targetNode && lease.active) {
        return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}
