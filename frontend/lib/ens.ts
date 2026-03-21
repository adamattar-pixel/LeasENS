import { createPublicClient, http } from 'viem';
import { normalize } from 'viem/ens';
import { sepolia } from 'viem/chains';

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
  const [status, tenant, rentAmount, startDate, endDate, personaVerified] = await Promise.all([
    getTextRecord(name, 'lease.status'),
    getTextRecord(name, 'lease.tenant'),
    getTextRecord(name, 'lease.rentAmount'),
    getTextRecord(name, 'lease.startDate'),
    getTextRecord(name, 'lease.endDate'),
    getTextRecord(name, 'persona.verified'),
  ]);
  return { status, tenant, rentAmount, startDate, endDate, personaVerified };
}

export async function subnameExists(name: string): Promise<boolean> {
  try {
    const addr = await resolveAddress(name);
    return addr !== null;
  } catch {
    return false;
  }
}
