/**
 * Setup ENS: Approve LeaseManager as operator on NameWrapper
 *
 * Usage:
 *   PRIVATE_KEY=0x... SEPOLIA_RPC=https://... LEASE_MANAGER_ADDRESS=0x... npx tsx scripts/setup-ens.ts
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8' as const;

const nameWrapperAbi = [
  {
    name: 'setApprovalForAll',
    type: 'function',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'isApprovedForAll',
    type: 'function',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error('Set PRIVATE_KEY env var');
  if (!process.env.SEPOLIA_RPC) throw new Error('Set SEPOLIA_RPC env var');
  if (!process.env.LEASE_MANAGER_ADDRESS) throw new Error('Set LEASE_MANAGER_ADDRESS env var');

  const rpc = process.env.SEPOLIA_RPC;
  const leaseManager = process.env.LEASE_MANAGER_ADDRESS as `0x${string}`;
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpc),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc),
  });

  console.log(`Account: ${account.address}`);
  console.log(`LeaseManager: ${leaseManager}`);

  // Check current approval
  const isApproved = await publicClient.readContract({
    address: NAME_WRAPPER,
    abi: nameWrapperAbi,
    functionName: 'isApprovedForAll',
    args: [account.address, leaseManager],
  });

  if (isApproved) {
    console.log('Already approved. Nothing to do.');
    return;
  }

  console.log('Approving LeaseManager on NameWrapper...');
  const txHash = await walletClient.writeContract({
    address: NAME_WRAPPER,
    abi: nameWrapperAbi,
    functionName: 'setApprovalForAll',
    args: [leaseManager, true],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Approved! Block: ${receipt.blockNumber}, Tx: ${txHash}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
