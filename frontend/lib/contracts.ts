import { type Address } from 'viem';

export const LEASE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_LEASE_MANAGER_ADDRESS as Address;
export const MOCK_USDC_ADDRESS     = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address;
export const NAME_WRAPPER_ADDRESS  = '0x0635513f179D50A207757E05759CbD106d7dFcE8' as Address;

export const leaseManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_nameWrapper', type: 'address' },
      { name: '_publicResolver', type: 'address' },
      { name: '_paymentToken', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'calculatePenalty',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [{ name: 'penalty', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createLease',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'tenant', type: 'address' },
      { name: 'rentAmount', type: 'uint256' },
      { name: 'durationMonths', type: 'uint256' },
      { name: 'penaltyBps', type: 'uint256' },
    ],
    outputs: [{ name: 'leaseId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLease',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOwnerLeases',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPaymentHistory',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [
      { name: 'timestamps', type: 'uint256[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTenantLeases',
    inputs: [{ name: 'tenant', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalDue',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'leaseCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nameWrapper',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'payRent',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'paymentToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'publicResolver',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerOwner',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'ownerAddress', type: 'address' },
    ],
    outputs: [{ name: 'ownerNode', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDueDateForDemo',
    inputs: [
      { name: 'leaseId', type: 'uint256' },
      { name: 'newDueDate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'terminateLease',
    inputs: [
      { name: 'leaseId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'accruePenalty',
    inputs: [{ name: 'leaseId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPersonaVerified',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'backendWallet',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PersonaVerified',
    inputs: [
      { name: 'node', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'MONTH',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_PENALTY_BPS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'LeaseCreated',
    inputs: [
      { name: 'leaseId', type: 'uint256', indexed: true },
      { name: 'parentNode', type: 'bytes32', indexed: true },
      { name: 'leaseNode', type: 'bytes32', indexed: false },
      { name: 'label', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: false },
      { name: 'tenant', type: 'address', indexed: false },
      { name: 'rentAmount', type: 'uint256', indexed: false },
      { name: 'startDate', type: 'uint256', indexed: false },
      { name: 'endDate', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RentPaid',
    inputs: [
      { name: 'leaseId', type: 'uint256', indexed: true },
      { name: 'tenant', type: 'address', indexed: true },
      { name: 'rentAmount', type: 'uint256', indexed: false },
      { name: 'penaltyPaid', type: 'uint256', indexed: false },
      { name: 'newDueDate', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PenaltyAccrued',
    inputs: [
      { name: 'leaseId', type: 'uint256', indexed: true },
      { name: 'penaltyAmount', type: 'uint256', indexed: false },
      { name: 'totalAccrued', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LeaseTerminated',
    inputs: [
      { name: 'leaseId', type: 'uint256', indexed: true },
      { name: 'terminatedBy', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnerRegistered',
    inputs: [
      { name: 'parentNode', type: 'bytes32', indexed: true },
      { name: 'ownerNode', type: 'bytes32', indexed: false },
      { name: 'label', type: 'string', indexed: false },
      { name: 'ownerAddress', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const mockUsdcAbi = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const nameWrapperAbi = [
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
