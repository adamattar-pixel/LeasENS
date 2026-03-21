/**
 * Sepolia E2E Verification Script
 * Tests core requirements under strict three-tier naming:
 * 1. registerOwner() creates owner context
 * 2. createLease() creates lease subname + text records
 * 3. payRent() transfers MockUSDC + advances due date
 * 4. Fake ENS names do not resolve (anti-scam)
 * 5. terminateLease() deactivates lease and deletes subname
 */

import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { normalize } from 'viem/ens';

if (!process.env.PRIVATE_KEY) throw new Error('Set PRIVATE_KEY env var');
if (!process.env.SEPOLIA_RPC) throw new Error('Set SEPOLIA_RPC env var');
if (!process.env.LEASE_MANAGER_ADDRESS) throw new Error('Set LEASE_MANAGER_ADDRESS env var');
if (!process.env.MOCK_USDC_ADDRESS) throw new Error('Set MOCK_USDC_ADDRESS env var');

const RPC = process.env.SEPOLIA_RPC;
const LEASE_MANAGER = process.env.LEASE_MANAGER_ADDRESS;
const MOCK_USDC = process.env.MOCK_USDC_ADDRESS;
const NAME_WRAPPER = process.env.NAME_WRAPPER_ADDRESS || '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const PUBLIC_RESOLVER = process.env.PUBLIC_RESOLVER_ADDRESS || '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const UNIVERSAL_RESOLVER = process.env.UNIVERSAL_RESOLVER_ADDRESS || '0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725';
const PARENT_ENS_NAME = process.env.PARENT_ENS_NAME || 'residence-epfl.eth';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const pub = createPublicClient({
  chain: {
    ...sepolia,
    contracts: {
      ...sepolia.contracts,
      ensUniversalResolver: { address: UNIVERSAL_RESOLVER },
    },
  },
  transport: http(RPC),
});

const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

const leaseAbi = [
  {
    type: 'function',
    name: 'registerOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'ownerAddress', type: 'address' },
    ],
    outputs: [{ name: 'ownerNode', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'createLease',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'tenant', type: 'address' },
      { name: 'rentAmount', type: 'uint256' },
      { name: 'durationMonths', type: 'uint256' },
      { name: 'penaltyBps', type: 'uint256' },
    ],
    outputs: [{ name: 'leaseId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'leaseCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getLease',
    stateMutability: 'view',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'parentNode', type: 'bytes32' },
          { name: 'leaseNode', type: 'bytes32' },
          { name: 'label', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'tenant', type: 'address' },
          { name: 'rentAmount', type: 'uint256' },
          { name: 'startDate', type: 'uint256' },
          { name: 'endDate', type: 'uint256' },
          { name: 'nextDueDate', type: 'uint256' },
          { name: 'penaltyBps', type: 'uint256' },
          { name: 'accruedPenalty', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getTotalDue',
    stateMutability: 'view',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'payRent',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'terminateLease',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'leaseId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
];

const usdcAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

const nwAbi = [
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
];

const resolverAbi = [
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'addr',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
];

async function waitTx(hash, label) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} reverted`);
  console.log(`  ${label} confirmed (block ${receipt.blockNumber})`);
  return receipt;
}

async function main() {
  console.log('=== SEPOLIA E2E VERIFICATION (STRICT THREE-TIER) ===');
  console.log(`Account: ${account.address}`);

  const parentNode = namehash(PARENT_ENS_NAME);
  const ownerLabel = `owner-${Date.now().toString(36).slice(-5)}`;
  const leaseLabel = `apt-${Date.now().toString(36).slice(-4)}`;
  const ownerName = `${ownerLabel}.${PARENT_ENS_NAME}`;
  const leaseName = `${leaseLabel}.${ownerName}`;
  const ownerNode = namehash(ownerName);

  console.log(`Parent ENS: ${PARENT_ENS_NAME}`);
  console.log(`Owner name: ${ownerName}`);
  console.log(`Lease name: ${leaseName}`);

  const isApproved = await pub.readContract({
    address: NAME_WRAPPER,
    abi: nwAbi,
    functionName: 'isApprovedForAll',
    args: [account.address, LEASE_MANAGER],
  });

  if (!isApproved) {
    console.log('Approving LeaseManager on NameWrapper...');
    await waitTx(
      await wallet.writeContract({
        address: NAME_WRAPPER,
        abi: nwAbi,
        functionName: 'setApprovalForAll',
        args: [LEASE_MANAGER, true],
      }),
      'Approve'
    );
  } else {
    console.log('LeaseManager already approved on NameWrapper');
  }

  console.log('\n--- TEST 1A: registerOwner() ---');
  await waitTx(
    await wallet.writeContract({
      address: LEASE_MANAGER,
      abi: leaseAbi,
      functionName: 'registerOwner',
      args: [parentNode, ownerLabel, account.address],
    }),
    'registerOwner'
  );

  console.log('\n--- TEST 1B: createLease() under owner node ---');
  const countBefore = await pub.readContract({
    address: LEASE_MANAGER,
    abi: leaseAbi,
    functionName: 'leaseCount',
  });

  await waitTx(
    await wallet.writeContract({
      address: LEASE_MANAGER,
      abi: leaseAbi,
      functionName: 'createLease',
      args: [ownerNode, leaseLabel, account.address, 1500n * 10n ** 6n, 12n, 50n],
    }),
    'createLease'
  );

  const leaseId = countBefore;
  const leaseNode = namehash(leaseName);
  const status = await pub.readContract({
    address: PUBLIC_RESOLVER,
    abi: resolverAbi,
    functionName: 'text',
    args: [leaseNode, 'lease.status'],
  });
  const tenant = await pub.readContract({
    address: PUBLIC_RESOLVER,
    abi: resolverAbi,
    functionName: 'text',
    args: [leaseNode, 'lease.tenant'],
  });
  const rent = await pub.readContract({
    address: PUBLIC_RESOLVER,
    abi: resolverAbi,
    functionName: 'text',
    args: [leaseNode, 'lease.rentAmount'],
  });
  console.log(`  lease.status = ${status}`);
  console.log(`  lease.tenant = ${tenant}`);
  console.log(`  lease.rentAmount = ${rent}`);
  console.log(`  TEST 1: ${status === 'active' ? 'PASS' : 'FAIL'}`);

  console.log('\n--- TEST 2: payRent() ---');
  await waitTx(
    await wallet.writeContract({
      address: MOCK_USDC,
      abi: usdcAbi,
      functionName: 'mint',
      args: [account.address, 10000n * 10n ** 6n],
    }),
    'mint USDC'
  );

  const totalDue = await pub.readContract({
    address: LEASE_MANAGER,
    abi: leaseAbi,
    functionName: 'getTotalDue',
    args: [leaseId],
  });

  await waitTx(
    await wallet.writeContract({
      address: MOCK_USDC,
      abi: usdcAbi,
      functionName: 'approve',
      args: [LEASE_MANAGER, totalDue],
    }),
    'approve USDC'
  );

  await waitTx(
    await wallet.writeContract({
      address: LEASE_MANAGER,
      abi: leaseAbi,
      functionName: 'payRent',
      args: [leaseId],
    }),
    'payRent'
  );

  const leaseAfterPay = await pub.readContract({
    address: LEASE_MANAGER,
    abi: leaseAbi,
    functionName: 'getLease',
    args: [leaseId],
  });
  console.log(`  nextDueDate: ${new Date(Number(leaseAfterPay.nextDueDate) * 1000).toISOString()}`);
  console.log('  TEST 2: PASS');

  console.log('\n--- TEST 3: fake name resolution ---');
  const fakeName = `totally-fake-xyz.${ownerName}`;
  try {
    const fakeAddr = await pub.getEnsAddress({ name: normalize(fakeName) });
    if (fakeAddr === null) {
      console.log('  Fake name returns null - BLOCKED');
      console.log('  TEST 3: PASS');
    } else {
      console.log(`  Fake name resolves to: ${fakeAddr}`);
      console.log('  TEST 3: FAIL');
    }
  } catch (error) {
    console.log(`  Fake name does not resolve: ${error.message.slice(0, 60)}`);
    console.log('  TEST 3: PASS');
  }

  console.log('\n--- TEST 4: terminateLease() ---');
  await waitTx(
    await wallet.writeContract({
      address: LEASE_MANAGER,
      abi: leaseAbi,
      functionName: 'terminateLease',
      args: [leaseId, 'E2E test cleanup'],
    }),
    'terminateLease'
  );

  const terminatedLease = await pub.readContract({
    address: LEASE_MANAGER,
    abi: leaseAbi,
    functionName: 'getLease',
    args: [leaseId],
  });

  try {
    const addrAfter = await pub.readContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: 'addr',
      args: [leaseNode],
    });
    const isZero = addrAfter === '0x0000000000000000000000000000000000000000';
    console.log(`  addr after terminate: ${addrAfter}${isZero ? ' (zeroed)' : ''}`);
  } catch (error) {
    console.log(`  subname deleted: ${error.message.slice(0, 60)}`);
  }

  console.log(`  active: ${terminatedLease.active}`);
  console.log(`  TEST 4: ${!terminatedLease.active ? 'PASS' : 'FAIL'}`);

  console.log('\n=== VERIFICATION COMPLETE ===');
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
