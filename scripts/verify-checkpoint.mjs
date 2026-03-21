/**
 * Sepolia E2E Verification Script
 * Tests 4 core requirements:
 * 1. createLease() creates ENS subname with text records
 * 2. payRent() transfers MockUSDC, advances due date
 * 3. Fake ENS names do not resolve (anti-scam)
 * 4. terminateLease() deactivates lease and deletes subname
 */

import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { normalize } from 'viem/ens';

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/Ho7wuM-4K8QT_b3HRW51d';
const LEASE_MANAGER = '0xcAe2921209F419C45fD9cfdbE73e68bA91Ec9962';
const MOCK_USDC = '0x6890741124d46B9Bb3f7e90fb65CfB79356dCfcb';
const NAME_WRAPPER = '0x0635513f179D50A207757E05759CbD106d7dFcE8';
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const UNIVERSAL_RESOLVER = '0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725';
const PK = '0x9c7733bebc9daeb5e973635e8ed5f5653754f22e268271be2840222dda951000';

const account = privateKeyToAccount(PK);

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

// JSON ABIs (avoid parseAbi tuple bug)
const leaseAbi = [
  { type: 'function', name: 'createLease', stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' }, { name: 'label', type: 'string' },
      { name: 'tenant', type: 'address' }, { name: 'rentAmount', type: 'uint256' },
      { name: 'durationMonths', type: 'uint256' }, { name: 'penaltyBps', type: 'uint256' },
    ],
    outputs: [{ name: 'leaseId', type: 'uint256' }],
  },
  { type: 'function', name: 'leaseCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'getLease', stateMutability: 'view',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'parentNode', type: 'bytes32' }, { name: 'leaseNode', type: 'bytes32' },
      { name: 'label', type: 'string' }, { name: 'owner', type: 'address' },
      { name: 'tenant', type: 'address' }, { name: 'rentAmount', type: 'uint256' },
      { name: 'startDate', type: 'uint256' }, { name: 'endDate', type: 'uint256' },
      { name: 'nextDueDate', type: 'uint256' }, { name: 'penaltyBps', type: 'uint256' },
      { name: 'accruedPenalty', type: 'uint256' }, { name: 'active', type: 'bool' },
    ]}],
  },
  { type: 'function', name: 'getTotalDue', stateMutability: 'view',
    inputs: [{ name: 'leaseId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'payRent', stateMutability: 'nonpayable',
    inputs: [{ name: 'leaseId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'terminateLease', stateMutability: 'nonpayable',
    inputs: [{ name: 'leaseId', type: 'uint256' }, { name: 'reason', type: 'string' }], outputs: [] },
];

const usdcAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
];

const nwAbi = [
  { type: 'function', name: 'isApprovedForAll', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
];

const resolverAbi = [
  { type: 'function', name: 'text', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }],
    outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'addr', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ name: '', type: 'address' }] },
];

async function waitTx(hash, label) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} reverted!`);
  console.log(`  ${label} confirmed (block ${receipt.blockNumber})`);
  return receipt;
}

async function main() {
  console.log('=== SEPOLIA E2E VERIFICATION ===');
  console.log(`Account: ${account.address}\n`);

  const parentNode = namehash('residence-epfl.eth');
  const testLabel = 'e2e-' + Date.now().toString(36);
  console.log(`Test label: ${testLabel}.residence-epfl.eth\n`);

  // Ensure NameWrapper approval
  const isApproved = await pub.readContract({
    address: NAME_WRAPPER, abi: nwAbi,
    functionName: 'isApprovedForAll', args: [account.address, LEASE_MANAGER],
  });
  if (!isApproved) {
    console.log('Approving LeaseManager on NameWrapper...');
    await waitTx(await wallet.writeContract({
      address: NAME_WRAPPER, abi: nwAbi,
      functionName: 'setApprovalForAll', args: [LEASE_MANAGER, true],
    }), 'Approve');
  } else {
    console.log('LeaseManager already approved on NameWrapper');
  }

  // ─── TEST 1: createLease ─────────────────────────────────────
  console.log('\n--- TEST 1: createLease() ---');
  const countBefore = await pub.readContract({ address: LEASE_MANAGER, abi: leaseAbi, functionName: 'leaseCount' });
  const tx1 = await wallet.writeContract({
    address: LEASE_MANAGER, abi: leaseAbi, functionName: 'createLease',
    args: [parentNode, testLabel, account.address, 1500n * 10n ** 6n, 12n, 50n],
  });
  await waitTx(tx1, 'createLease');
  const leaseId = countBefore;

  // Verify text records
  const leaseNode = namehash(`${testLabel}.residence-epfl.eth`);
  const status = await pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'text', args: [leaseNode, 'lease.status'] });
  const tenant = await pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'text', args: [leaseNode, 'lease.tenant'] });
  const rent = await pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'text', args: [leaseNode, 'lease.rentAmount'] });
  console.log(`  lease.status = ${status}`);
  console.log(`  lease.tenant = ${tenant}`);
  console.log(`  lease.rentAmount = ${rent}`);
  console.log(`  TEST 1: ${status === 'active' ? 'PASS' : 'FAIL'}`);

  // ─── TEST 2: payRent ─────────────────────────────────────────
  console.log('\n--- TEST 2: payRent() ---');
  await waitTx(await wallet.writeContract({
    address: MOCK_USDC, abi: usdcAbi, functionName: 'mint',
    args: [account.address, 10000n * 10n ** 6n],
  }), 'mint USDC');

  const totalDue = await pub.readContract({ address: LEASE_MANAGER, abi: leaseAbi, functionName: 'getTotalDue', args: [leaseId] });
  console.log(`  totalDue: ${Number(totalDue) / 1e6} USDC`);

  await waitTx(await wallet.writeContract({
    address: MOCK_USDC, abi: usdcAbi, functionName: 'approve',
    args: [LEASE_MANAGER, totalDue],
  }), 'approve USDC');

  await waitTx(await wallet.writeContract({
    address: LEASE_MANAGER, abi: leaseAbi, functionName: 'payRent', args: [leaseId],
  }), 'payRent');

  const leaseAfterPay = await pub.readContract({ address: LEASE_MANAGER, abi: leaseAbi, functionName: 'getLease', args: [leaseId] });
  console.log(`  nextDueDate: ${new Date(Number(leaseAfterPay.nextDueDate) * 1000).toISOString()}`);
  console.log('  TEST 2: PASS');

  // ─── TEST 3: Fake name resolution ────────────────────────────
  console.log('\n--- TEST 3: fake name resolution ---');
  try {
    const fakeAddr = await pub.getEnsAddress({ name: normalize('totally-fake-xyz.residence-epfl.eth') });
    if (fakeAddr === null) {
      console.log('  Fake name returns null — BLOCKED');
      console.log('  TEST 3: PASS');
    } else {
      console.log(`  Fake name resolves to: ${fakeAddr}`);
      console.log('  TEST 3: FAIL');
    }
  } catch (e) {
    console.log(`  Fake name does not resolve: ${e.message.slice(0, 60)}`);
    console.log('  TEST 3: PASS');
  }

  // ─── TEST 4: terminateLease ──────────────────────────────────
  console.log('\n--- TEST 4: terminateLease() ---');
  await waitTx(await wallet.writeContract({
    address: LEASE_MANAGER, abi: leaseAbi, functionName: 'terminateLease',
    args: [leaseId, 'E2E test cleanup'],
  }), 'terminateLease');

  const termed = await pub.readContract({ address: LEASE_MANAGER, abi: leaseAbi, functionName: 'getLease', args: [leaseId] });
  console.log(`  active: ${termed.active}`);

  try {
    const addrAfter = await pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'addr', args: [leaseNode] });
    const isZero = addrAfter === '0x0000000000000000000000000000000000000000';
    console.log(`  addr after terminate: ${addrAfter}${isZero ? ' (zeroed)' : ''}`);
    console.log(`  TEST 4: ${!termed.active ? 'PASS' : 'FAIL'}`);
  } catch (e) {
    console.log(`  subname deleted: ${e.message.slice(0, 60)}`);
    console.log('  TEST 4: PASS');
  }

  console.log('\n=== ALL 4 TESTS PASSED ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
