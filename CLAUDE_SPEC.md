# CLAUDE.md — ENS Rental Payment Platform

> Read this file fully before writing any code. Every architectural decision, scope boundary, and implementation detail is here. When in doubt, refer back to this file.

---

## Project Overview

An on-chain rental payment system where ENS subnames represent active leases. A property manager owns a root ENS name. When a lease is created for a tenant, the system mints an ENS subname that resolves to the tenant's address, with lease terms stored as ENS text records. Tenants pay rent in stablecoins. The subname's existence IS the proof of an active lease — a fake payment link resolves to a subname with no valid lease, which the app rejects before any money moves.

### The core security guarantee
Fake QR / payment link → ENS name doesn't exist or has no valid lease in the contract → app shows "Invalid payment link" and blocks payment. No trust required — it's cryptographically verifiable.

### Hackathon context
- Event: StableCoins and Payments Hackathon by BSA at EPFL
- Track: ENS (Ethereum Name Service)
- Team size: 2
- Deliverables: GitHub repo + README, testnet deployment, 5-minute pitch + 5-minute judge Q&A

---

## Decisions Log

Every decision here is final. Don't re-open these during the hackathon.

| Decision | Choice | Reason |
|---|---|---|
| Network | Ethereum Sepolia | ENS NameWrapper only works cleanly on Eth Sepolia |
| Stablecoin | MockUSDC (mintable ERC-20) | Real USDC not usably available on Sepolia |
| Contract architecture | Single `LeaseManager.sol` | Simpler, faster to build, fewer integration points |
| Subname ownership | Contract retains ownership (Option A) | Simplest — contract can always update text records |
| Wallet — tenants | Privy embedded wallet (email login) | Non-technical users, hits AA bonus criteria |
| Wallet — owner/PM | MetaMask / injected EOA | Technical actor, standard wallet is fine |
| Late penalties | Include (basis points per day) | ~2h extra, strong demo moment with `setDueDateForDemo` |
| Lease termination | Include (ENS subname deletion) | High-impact demo: name stops resolving |
| Persona KYC | Mocked — writes `persona.verified=true` to ENS text record | Hits cross-app identity bonus, no API dependency |
| Payment UX | Clickable link `/pay/[ensName]` + QR is same URL encoded | Link is primary, QR is secondary, both same page |
| Three-tier hierarchy | PM → Owner → Tenant | Better ENS story, hits subname bonus criteria |
| Frontend | Next.js 14 App Router + TypeScript strict + Tailwind | Industry standard, fast to prototype |
| Contract tooling | Foundry | Faster test loop, better for hackathon |
| Repo | Monorepo: `/contracts` + `/frontend` | Backend lives as Next.js API routes in `/frontend/app/api` |

---

## ENS Contract Addresses (Ethereum Sepolia)

These are exact deployed addresses. Use them verbatim.

```
ENSRegistry:                 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
BaseRegistrarImplementation: 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85
ETHRegistrarController:      0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72
PublicResolver:              0x8FADE66B79cC9f707aB26799354482EB93a5B7dD
NameWrapper:                 0x0635513f179D50A207757E05759CbD106d7dFcE8
UniversalResolver:           0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725
ReverseRegistrar:            0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6
```

The two you interact with most: `NameWrapper` and `PublicResolver`. Both are constructor parameters of `LeaseManager`.

---

## Architecture Overview

```
[Property Manager — pre-deployed for demo]
  └── Owns root ENS name e.g. `residence-epfl.eth` (registered manually on Sepolia)
  └── Calls nameWrapper.setApprovalForAll(leaseManager, true) once via setup script
  └── Calls leaseManager.registerOwner() to create owner subnames

[Owner e.g. `dupont.residence-epfl.eth`]
  └── Calls nameWrapper.setApprovalForAll(leaseManager, true) once via UI
  └── Calls leaseManager.createLease() to create tenant lease subnames

[Tenant lease subname e.g. `apt1.dupont.residence-epfl.eth`]
  ├── addr record        → tenant's Privy wallet address
  ├── lease.rentAmount   → "1500000000" (1500 USDC, 6 decimals)
  ├── lease.token        → "USDC"
  ├── lease.startDate    → unix timestamp string
  ├── lease.endDate      → unix timestamp string
  ├── lease.status       → "active" | "terminated"
  ├── lease.tenant       → tenant address string
  ├── persona.verified   → "true"
  └── persona.timestamp  → unix timestamp of KYC verification

[Payment flow]
  1. Tenant receives link: https://app.com/pay/apt1.dupont.residence-epfl.eth
  2. App resolves ENS name → checks subnameExists()
  3. App fetches lease text records + leaseId from contract
  4. App shows: amount due, penalty if late, total due, verified badge
  5. Tenant approves MockUSDC + calls payRent(leaseId)
  6. USDC transfers to owner, due date advances
  7. Fake link → ENS name doesn't exist → "Invalid payment link" shown

[Lease termination]
  Owner calls terminateLease() → contract calls nameWrapper.setSubnodeOwner(..., address(0))
  → subname deleted → name no longer resolves → verifiable proof lease is over
```

---

## Repository Structure

```
/
├── contracts/
│   ├── src/
│   │   ├── LeaseManager.sol
│   │   ├── MockUSDC.sol
│   │   └── interfaces/
│   │       ├── INameWrapper.sol
│   │       └── IPublicResolver.sol
│   ├── test/
│   │   └── LeaseManager.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   ├── foundry.toml
│   ├── remappings.txt
│   └── .env
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── pay/[ensName]/page.tsx
│   │   ├── tenant/dashboard/page.tsx
│   │   ├── owner/
│   │   │   ├── dashboard/page.tsx
│   │   │   └── create-lease/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── onboard/add-owner/page.tsx
│   │   └── api/
│   │       ├── kyc/initiate/route.ts
│   │       ├── kyc/webhook/route.ts
│   │       └── qr/[ensName]/route.ts
│   ├── components/
│   │   ├── WalletConnect.tsx
│   │   ├── PaymentCard.tsx
│   │   ├── LeaseCard.tsx
│   │   ├── KYCFlow.tsx
│   │   ├── QRCode.tsx
│   │   └── TransactionStatus.tsx
│   ├── lib/
│   │   ├── ens.ts
│   │   ├── contracts.ts
│   │   ├── wagmi.ts
│   │   └── privy.ts
│   ├── hooks/
│   │   ├── useLease.ts
│   │   ├── usePayRent.ts
│   │   └── useENSProfile.ts
│   ├── types/index.ts
│   └── .env.local
├── scripts/
│   └── setup-ens.ts
└── CLAUDE.md
```

---

## Smart Contracts

### interfaces/INameWrapper.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);

    function ownerOf(uint256 id) external view returns (address);
    function getData(uint256 id) external view returns (address, uint32, uint64);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
}
```

### interfaces/IPublicResolver.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function setAddr(bytes32 node, address addr) external;
    function addr(bytes32 node) external view returns (address);
}
```

### MockUSDC.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint — for testing only
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

### LeaseManager.sol

Single contract handling the full lifecycle: owner onboarding, lease creation (ENS subname + text records), rent payment, late penalty, lease termination (ENS subname deletion).

**Subname ownership decision (Option A)**: The contract retains permanent ownership of all lease subnames. This means it can always update text records without permission issues. The tenant's address is stored in the Lease struct and in the `lease.tenant` text record. The addr record still resolves to the tenant.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./interfaces/INameWrapper.sol";
import "./interfaces/IPublicResolver.sol";

contract LeaseManager is ERC1155Holder {

    // ─── Constants ───────────────────────────────────────────────
    INameWrapper    public immutable nameWrapper;
    IPublicResolver public immutable publicResolver;
    IERC20          public immutable paymentToken;

    uint256 public constant MONTH           = 30 days;
    uint256 public constant MAX_PENALTY_BPS = 10000; // 100% of rent

    // ─── Storage ─────────────────────────────────────────────────
    struct Lease {
        bytes32 parentNode;       // namehash of owner's ENS name
        bytes32 leaseNode;        // namehash of the lease subname
        string  label;            // e.g. "apt1"
        address owner;            // rent recipient
        address tenant;           // rent payer
        uint256 rentAmount;       // monthly rent in token units (6 decimals)
        uint256 startDate;
        uint256 endDate;
        uint256 nextDueDate;
        uint256 penaltyBps;       // basis points per day late (e.g. 50 = 0.5%/day)
        uint256 accruedPenalty;
        bool    active;
    }

    mapping(uint256 => Lease)     public leases;
    uint256                       public leaseCount;
    mapping(uint256 => uint256[]) public paymentTimestamps;
    mapping(uint256 => uint256[]) public paymentAmounts;

    // ─── Events ──────────────────────────────────────────────────
    event LeaseCreated(
        uint256 indexed leaseId, bytes32 indexed parentNode,
        bytes32 leaseNode, string label, address owner, address tenant,
        uint256 rentAmount, uint256 startDate, uint256 endDate
    );
    event RentPaid(
        uint256 indexed leaseId, address indexed tenant,
        uint256 rentAmount, uint256 penaltyPaid, uint256 newDueDate
    );
    event PenaltyAccrued(uint256 indexed leaseId, uint256 penaltyAmount, uint256 totalAccrued);
    event LeaseTerminated(uint256 indexed leaseId, address indexed terminatedBy, string reason);
    event OwnerRegistered(bytes32 indexed parentNode, bytes32 ownerNode, string label, address ownerAddress);

    // ─── Constructor ─────────────────────────────────────────────
    constructor(address _nameWrapper, address _publicResolver, address _paymentToken) {
        nameWrapper    = INameWrapper(_nameWrapper);
        publicResolver = IPublicResolver(_publicResolver);
        paymentToken   = IERC20(_paymentToken);
    }

    // ─── Owner Onboarding (P2) ───────────────────────────────────
    /// @notice PM creates an owner subname (e.g. dupont.residence-epfl.eth)
    /// @dev PM must have called nameWrapper.setApprovalForAll(address(this), true) first.
    ///      After this call, the owner wallet must ALSO call setApprovalForAll so
    ///      the LeaseManager can create lease subnames under the owner's name.
    function registerOwner(
        bytes32 parentNode,
        string calldata label,
        address ownerAddress
    ) external returns (bytes32 ownerNode) {
        require(ownerAddress != address(0), "Invalid owner");
        uint64 expiry = uint64(block.timestamp + 365 days);

        // Create subname with this contract as temp owner to set text records
        ownerNode = nameWrapper.setSubnodeRecord(
            parentNode, label, address(this), address(publicResolver), 0, 0, expiry
        );

        publicResolver.setAddr(ownerNode, ownerAddress);
        publicResolver.setText(ownerNode, "role", "owner");
        publicResolver.setText(ownerNode, "owner.address", _addr2str(ownerAddress));

        // Transfer ownership to actual owner wallet
        nameWrapper.setSubnodeOwner(parentNode, label, ownerAddress, 0, expiry);

        emit OwnerRegistered(parentNode, ownerNode, label, ownerAddress);
    }

    // ─── Lease Creation (P0) ─────────────────────────────────────
    /// @notice Owner creates a lease and mints an ENS subname for the tenant.
    /// @dev Owner must have called nameWrapper.setApprovalForAll(address(this), true) first.
    ///      The contract retains subname ownership permanently (Option A) so it can
    ///      always update text records (e.g. lease.status after payment/termination).
    function createLease(
        bytes32 parentNode,
        string calldata label,
        address tenant,
        uint256 rentAmount,
        uint256 durationMonths,
        uint256 penaltyBps
    ) external returns (uint256 leaseId) {
        require(tenant != address(0), "Invalid tenant");
        require(rentAmount > 0, "Rent must be > 0");
        require(durationMonths > 0, "Duration must be > 0");
        require(penaltyBps <= 1000, "Max 10%/day");

        leaseId = leaseCount++;
        uint256 startDate = block.timestamp;
        uint256 endDate   = startDate + (durationMonths * MONTH);

        // Step 1: Mint subname — contract keeps ownership permanently
        bytes32 leaseNode = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            address(this),            // Contract = permanent owner
            address(publicResolver),
            0,
            0,                        // No fuses burned: parent retains PARENT_CANNOT_CONTROL
            uint64(endDate + 365 days)
        );

        // Step 2: Set text records (we can do this because we own the subname)
        publicResolver.setText(leaseNode, "lease.rentAmount", _uint2str(rentAmount));
        publicResolver.setText(leaseNode, "lease.token",      "USDC");
        publicResolver.setText(leaseNode, "lease.startDate",  _uint2str(startDate));
        publicResolver.setText(leaseNode, "lease.endDate",    _uint2str(endDate));
        publicResolver.setText(leaseNode, "lease.status",     "active");
        publicResolver.setText(leaseNode, "lease.tenant",     _addr2str(tenant));

        // Step 3: Set addr record to tenant (name resolves to tenant's wallet)
        publicResolver.setAddr(leaseNode, tenant);

        // Step 4: Store lease data
        leases[leaseId] = Lease({
            parentNode:     parentNode,
            leaseNode:      leaseNode,
            label:          label,
            owner:          msg.sender,
            tenant:         tenant,
            rentAmount:     rentAmount,
            startDate:      startDate,
            endDate:        endDate,
            nextDueDate:    startDate + MONTH,
            penaltyBps:     penaltyBps,
            accruedPenalty: 0,
            active:         true
        });

        emit LeaseCreated(leaseId, parentNode, leaseNode, label,
            msg.sender, tenant, rentAmount, startDate, endDate);
    }

    // ─── Rent Payment (P0) ───────────────────────────────────────
    /// @notice Tenant pays rent for a lease.
    /// @dev Tenant must approve this contract to spend paymentToken before calling.
    ///      Handles penalty calculation, USDC transfer, due date advancement,
    ///      and ENS text record update.
    function payRent(uint256 leaseId) external {
        Lease storage lease = leases[leaseId];
        require(lease.active,                     "Lease not active");
        require(msg.sender == lease.tenant,        "Only tenant can pay");
        require(block.timestamp <= lease.endDate,  "Lease expired");

        uint256 penalty  = calculatePenalty(leaseId);
        uint256 totalDue = lease.rentAmount + penalty + lease.accruedPenalty;

        require(
            paymentToken.transferFrom(msg.sender, lease.owner, totalDue),
            "Payment failed"
        );

        paymentTimestamps[leaseId].push(block.timestamp);
        paymentAmounts[leaseId].push(totalDue);

        lease.accruedPenalty = 0;
        lease.nextDueDate    = lease.nextDueDate + MONTH;

        // Update text record — possible because contract owns the subname
        publicResolver.setText(lease.leaseNode, "lease.lastPaid", _uint2str(block.timestamp));

        emit RentPaid(leaseId, msg.sender, lease.rentAmount,
            penalty + lease.accruedPenalty, lease.nextDueDate);
    }

    // ─── Penalty (P1) ────────────────────────────────────────────
    /// @notice View-only: returns current penalty amount for a lease.
    ///         Formula: rentAmount * penaltyBps * daysLate / 10000, capped at 100% of rent.
    function calculatePenalty(uint256 leaseId) public view returns (uint256 penalty) {
        Lease storage lease = leases[leaseId];
        if (!lease.active || block.timestamp <= lease.nextDueDate) return 0;

        uint256 daysLate = (block.timestamp - lease.nextDueDate) / 1 days;
        if (daysLate == 0) return 0;

        penalty = (lease.rentAmount * lease.penaltyBps * daysLate) / 10000;
        if (penalty > lease.rentAmount) penalty = lease.rentAmount;
    }

    function accruePenalty(uint256 leaseId) external {
        Lease storage lease = leases[leaseId];
        require(lease.active, "Lease not active");
        uint256 penalty = calculatePenalty(leaseId);
        if (penalty > 0) {
            lease.accruedPenalty += penalty;
            lease.nextDueDate     = lease.nextDueDate + MONTH;
            emit PenaltyAccrued(leaseId, penalty, lease.accruedPenalty);
        }
    }

    /// @notice FOR DEMO ONLY — backdates the due date to simulate a late payment scenario
    function setDueDateForDemo(uint256 leaseId, uint256 newDueDate) external {
        require(leases[leaseId].active,              "Lease not active");
        require(msg.sender == leases[leaseId].owner, "Only owner");
        leases[leaseId].nextDueDate = newDueDate;
    }

    // ─── Termination (P1) ────────────────────────────────────────
    /// @notice Owner terminates a lease and deletes the ENS subname.
    /// @dev Sets subname owner to address(0) via NameWrapper — name stops resolving.
    ///      Works because fuses=0 was set on creation (parent retains PARENT_CANNOT_CONTROL).
    function terminateLease(uint256 leaseId, string calldata reason) external {
        Lease storage lease = leases[leaseId];
        require(lease.active,              "Lease not active");
        require(msg.sender == lease.owner, "Only owner");

        lease.active = false;

        nameWrapper.setSubnodeOwner(
            lease.parentNode,
            lease.label,
            address(0), // Delete: owner = zero address
            0,
            0
        );

        emit LeaseTerminated(leaseId, msg.sender, reason);
    }

    // ─── View Functions ──────────────────────────────────────────
    function getLease(uint256 leaseId) external view returns (Lease memory) {
        return leases[leaseId];
    }

    function getTotalDue(uint256 leaseId) external view returns (uint256) {
        Lease storage lease = leases[leaseId];
        if (!lease.active) return 0;
        return lease.rentAmount + calculatePenalty(leaseId) + lease.accruedPenalty;
    }

    function getPaymentHistory(uint256 leaseId) external view
        returns (uint256[] memory timestamps, uint256[] memory amounts)
    {
        return (paymentTimestamps[leaseId], paymentAmounts[leaseId]);
    }

    function getOwnerLeases(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].owner == owner && leases[i].active) count++;
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].owner == owner && leases[i].active) result[idx++] = i;
        return result;
    }

    function getTenantLeases(address tenant) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].tenant == tenant && leases[i].active) count++;
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < leaseCount; i++)
            if (leases[i].tenant == tenant && leases[i].active) result[idx++] = i;
        return result;
    }

    // ─── Helpers ─────────────────────────────────────────────────
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _addr2str(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0"; s[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(addr) >> (8 * (19 - i)));
            s[2 + i * 2] = _hexChar(b >> 4);
            s[3 + i * 2] = _hexChar(b & 0x0f);
        }
        return string(s);
    }

    function _hexChar(uint8 value) internal pure returns (bytes1) {
        return value < 10 ? bytes1(uint8(48 + value)) : bytes1(uint8(87 + value));
    }
}
```

---

## Foundry Configuration

```toml
# contracts/foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
```

```
# contracts/remappings.txt
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

Install deps:
```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

### Deploy.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/LeaseManager.sol";

contract Deploy is Script {
    address constant NAME_WRAPPER    = 0x0635513f179D50A207757E05759CbD106d7dFcE8;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        LeaseManager leaseManager = new LeaseManager(
            NAME_WRAPPER,
            PUBLIC_RESOLVER,
            address(usdc)
        );

        console.log("MockUSDC deployed at:     ", address(usdc));
        console.log("LeaseManager deployed at: ", address(leaseManager));

        vm.stopBroadcast();
    }
}
```

Deploy command:
```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

---

## ENS Setup Script

Run this ONCE after deploying contracts. Approves LeaseManager as NameWrapper operator so it can create subnames.

**Prerequisites before running**:
1. Register your root ENS name at https://app.ens.domains/ on Sepolia (e.g. `residence-epfl.eth`) — costs ~0.003 Sepolia ETH
2. Names registered on Sepolia are automatically wrapped in the NameWrapper
3. Get Sepolia ETH: https://sepolia-faucet.pk910.de or https://www.alchemy.com/faucets/ethereum-sepolia

```typescript
// scripts/setup-ens.ts — run with: npx tsx scripts/setup-ens.ts
import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY    = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL        = process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org';
const LEASE_MANAGER  = process.env.LEASE_MANAGER_ADDRESS as `0x${string}`;
const PARENT_NAME    = process.env.PARENT_ENS_NAME || 'residence-epfl.eth';
const NAME_WRAPPER   = '0x0635513f179D50A207757E05759CbD106d7dFcE8' as `0x${string}`;

const abi = [
  { name: 'setApprovalForAll', type: 'function',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
    outputs: [], stateMutability: 'nonpayable' },
  { name: 'isApprovedForAll', type: 'function',
    inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
] as const;

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet  = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const pub     = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  const parentNode = namehash(PARENT_NAME);
  console.log(`Parent ENS name: ${PARENT_NAME}`);
  console.log(`Parent namehash: ${parentNode}`);

  const tx = await wallet.writeContract({
    address: NAME_WRAPPER, abi,
    functionName: 'setApprovalForAll', args: [LEASE_MANAGER, true],
  });
  await pub.waitForTransactionReceipt({ hash: tx });

  const approved = await pub.readContract({
    address: NAME_WRAPPER, abi,
    functionName: 'isApprovedForAll', args: [account.address, LEASE_MANAGER],
  });

  console.log('\n=== SETUP COMPLETE ===');
  console.log(`LeaseManager approved: ${approved}`);
  console.log(`\nCopy this into .env.local as NEXT_PUBLIC_PARENT_NODE:\n${parentNode}`);
}

main().catch(console.error);
```

**Important**: After `registerOwner()` transfers ownership of an owner subname to the owner's wallet, that owner MUST also call `nameWrapper.setApprovalForAll(leaseManagerAddress, true)` from their wallet. This is a one-click action in the Owner Onboarding UI (`/onboard/add-owner`).

---

## Frontend

### Package dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.0.0",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0",
    "@tanstack/react-query": "^5.59.0",
    "@privy-io/react-auth": "^1.80.0",
    "@privy-io/wagmi": "^0.2.0",
    "tailwindcss": "^3.4.0",
    "qrcode": "^1.5.4",
    "@types/qrcode": "^1.5.5"
  }
}
```

### lib/wagmi.ts

```typescript
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Must override UniversalResolver for ENS resolution to work on Sepolia
const sepoliaWithENS = {
  ...sepolia,
  contracts: {
    ...sepolia.contracts,
    ensUniversalResolver: {
      address: '0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725' as `0x${string}`,
    },
  },
};

export const wagmiConfig = createConfig({
  chains: [sepoliaWithENS],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
  },
});
```

### lib/contracts.ts

```typescript
import { type Address } from 'viem';

export const LEASE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_LEASE_MANAGER_ADDRESS as Address;
export const MOCK_USDC_ADDRESS     = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address;
export const NAME_WRAPPER_ADDRESS  = '0x0635513f179D50A207757E05759CbD106d7dFcE8' as Address;

// After `forge build`, copy ABIs from contracts/out/LeaseManager.sol/LeaseManager.json
export const leaseManagerAbi = [] as const; // TODO: fill after forge build
export const mockUsdcAbi     = [] as const; // TODO: fill after forge build

export const nameWrapperAbi = [
  { name: 'setApprovalForAll', type: 'function',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
    outputs: [], stateMutability: 'nonpayable' },
  { name: 'isApprovedForAll', type: 'function',
    inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
] as const;
```

### lib/ens.ts

```typescript
import { createPublicClient, http, normalize } from 'viem';
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
```

---

## Key Pages

### `/` — Landing
Two buttons: "I'm a Tenant" → `/onboarding` and "I'm an Owner" → `/owner/dashboard`. One sentence product description. Clean, minimal.

### `/onboarding` — Tenant onboarding
```
Step 1: "Connect with email" via Privy → embedded wallet created, no seed phrase needed
Step 2: Mock KYC — "Verify Identity" button → 2s fake loading → "Verified ✓"
Step 3: POST /api/kyc/webhook → backend writes persona.verified=true + timestamp to ENS text record
Step 4: Show tenant their ENS subname + clickable payment link + QR code
```

### `/pay/[ensName]` — Payment page (THE core demo page)
```
1. Resolve ensName via lib/ens.ts → subnameExists()
2. NOT EXISTS → red "Invalid payment link — no verified lease found for this address" (anti-scam guard)
3. EXISTS → fetch getLeaseRecords() + call getTotalDue(leaseId) from contract
4. Display: ENS name, property label, monthly rent, penalty if late, total due, green "Verified Lease" badge
5. "Mint 10,000 USDC" button → MockUSDC.mint(connectedAddress, 10000 * 10^6)
6. "Approve USDC" → mockUsdc.approve(leaseManagerAddress, totalDue)
7. "Pay Rent" → leaseManager.payRent(leaseId)
8. Show tx hash + "Payment confirmed" success state
```
Note: finding the leaseId from an ENS name — iterate `getTenantLeases(tenantAddress)` and match `leaseNode` against `namehash(ensName)`.

### `/owner/create-lease` — Create lease
```
Owner connects wallet (MetaMask)
Inputs: tenant address, apartment label (e.g. "apt1"), monthly rent in USDC, duration in months, penalty rate bps/day (default: 50)
parentNode is read from NEXT_PUBLIC_PARENT_NODE env — never ask the owner to type it
"Create Lease" → leaseManager.createLease(parentNode, label, tenant, amount * 10^6, duration, penaltyBps)
On success: "Created apt1.dupont.residence-epfl.eth" + link to verify on https://app.ens.domains
```

### `/owner/dashboard` — Owner lease management
```
List all active leases from getOwnerLeases(connectedAddress)
For each: ENS subname, tenant address, rent amount, next due date, total payments received
"Simulate Late Payment" → leaseManager.setDueDateForDemo(leaseId, now - 5days) [demo only button]
"Terminate Lease" → leaseManager.terminateLease(leaseId, "Terminated by owner")
On termination: show "Lease terminated — ENS subname deleted"
```

### `/tenant/dashboard` — Tenant lease view
```
Connect wallet → getTenantLeases(address) → show lease cards
Each card: ENS subname, rent amount, next due date, payment history count
"Pay Rent" button → links to /pay/[ensName]
"Mint Test USDC" button for demo convenience
```

### `/onboard/add-owner` — PM creates owner subname (P2)
```
PM connects wallet
Input: owner wallet address, owner label (e.g. "dupont")
"Add Owner" → leaseManager.registerOwner(parentNode, label, ownerAddress)
On success: "Created dupont.residence-epfl.eth resolving to [address]"
Banner shown: "The owner must now approve the LeaseManager"
Owner connects wallet on same page → "Approve LeaseManager" button
  → nameWrapper.setApprovalForAll(leaseManagerAddress, true)
After approval: owner can create leases
```

---

## Backend API Routes

### POST `/api/kyc/initiate`
```typescript
// Body: { walletAddress: string, ensName: string }
// Returns: { sessionId: string }
// Just generates a UUID — no external call, fully mocked
```

### POST `/api/kyc/webhook`
```typescript
// Body: { sessionId: string, ensName: string }
// Action: write persona.verified=true to ENS text records
//
// Implementation note: The backend wallet needs to be able to call
// publicResolver.setText() on the lease subname.
// Since the LeaseManager contract owns the subname, add this function to LeaseManager:
//
//   function setPersonaVerified(bytes32 node) external onlyBackend {
//     publicResolver.setText(node, "persona.verified", "true");
//     publicResolver.setText(node, "persona.timestamp", _uint2str(block.timestamp));
//   }
//
// Where onlyBackend checks msg.sender == backendWallet (set in constructor).
// The backend calls this via viem using BACKEND_WALLET_PRIVATE_KEY.
//
// Returns: { success: true, txHash: string }
```

### GET `/api/qr/[ensName]`
```typescript
// Generates QR code PNG of the payment link URL
// URL: `${NEXT_PUBLIC_APP_URL}/pay/${ensName}`
// Uses: qrcode npm package — QRCode.toBuffer(url, { type: 'png' })
// Returns: Response with Content-Type: image/png
// Used by: QRCode.tsx via <img src="/api/qr/apt1.dupont.residence-epfl.eth" />
```

---

## Environment Variables

### `/contracts/.env`
```env
PRIVATE_KEY=0x...
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_key
LEASE_MANAGER_ADDRESS=    # fill after deployment
PARENT_ENS_NAME=residence-epfl.eth
```

### `/frontend/.env.local`
```env
NEXT_PUBLIC_PRIVY_APP_ID=              # from https://privy.io dashboard
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=     # deployed LeaseManager address
NEXT_PUBLIC_MOCK_USDC_ADDRESS=         # deployed MockUSDC address
NEXT_PUBLIC_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PARENT_NODE=               # output of setup-ens.ts (namehash of root ENS name)
NEXT_PUBLIC_PARENT_ENS_NAME=residence-epfl.eth
BACKEND_WALLET_PRIVATE_KEY=0x...       # wallet that calls setPersonaVerified()
```

---

## Build Order — 2 People, ~16 Hours

### Phase 1 — Contracts [Hours 0–5] — Person A
```
[0–0.5h] Foundry init, install OpenZeppelin, set up remappings
[0.5–3h] MockUSDC + interfaces + LeaseManager.sol (use code above verbatim)
[3–4h]   LeaseManager.t.sol — test createLease, payRent, calculatePenalty, terminateLease
[4–5h]   Deploy to Sepolia → run setup-ens.ts → fill .env files → share addresses with Person B
```

### Phase 2 — Scaffold + /pay page [Hours 0–5] — Person B (parallel)
```
[0–1h]   Next.js scaffold, Privy setup, wagmi config, Tailwind
[1–2h]   lib/ens.ts + lib/wagmi.ts (ABIs can be stubbed until Person A compiles)
[2–5h]   /pay/[ensName] — full flow: resolve ENS, anti-scam guard, show amount,
          approve USDC, payRent, success state
          hooks/usePayRent.ts — approve + payRent two-step sequence
```

### Phase 3 — Remaining pages [Hours 5–12]
```
[5–7h]   Person A: /owner/create-lease + /owner/dashboard (terminate + setDueDateForDemo)
[5–7h]   Person B: /onboarding (Privy login + mock KYC + ENS text record write)
                   POST /api/kyc/webhook + GET /api/qr/[ensName]
[7–9h]   Person A: /tenant/dashboard
[7–9h]   Person B: /onboard/add-owner (P2 — registerOwner + owner approval flow)
[9–10h]  Both: integrate, test full flow end-to-end on Sepolia
```

### Checkpoint [Hour 10]
> Do these three things work on Sepolia?
> 1. createLease → ENS subname exists with text records
> 2. payRent → MockUSDC transfers, due date advances
> 3. /pay/fake-name → "Invalid payment link" shown
>
> If NO → all hands fixing these. Drop P2 (add-owner UI), use cast commands instead.
> If YES → proceed to Phase 4.

### Phase 4 — Polish + Pitch Prep [Hours 10–16]
```
[10–12h] Landing page, consistent Tailwind styling across all pages
[12–13h] Rehearse demo (see script below) — identify rough edges
[13–14h] Fix bugs from rehearsal
[14–16h] Pitch slides + practice 5-minute presentation
```

### Decision gates
| Hour | If behind | Drop |
|---|---|---|
| 5 | Contracts not on Sepolia | Person A keeps going, Person B mocks contract calls |
| 10 | P0 not working | All hands on P0, skip add-owner UI entirely |
| 12 | Behind on polish | Drop tenant dashboard, tenant goes straight to /pay/[ensName] |

### Never drop
- Lease creation with ENS subname + text records
- Rent payment in MockUSDC
- `/pay/[ensName]` anti-scam validation
- These three things ARE the demo.

---

## Demo Script (5 minutes)

Rehearse until it takes exactly 4 minutes. Leave 1 minute buffer.

**[0:00–0:30] The problem**
"Every month, student residencies send a QR code for rent. Scammers send identical-looking fakes. Students lose money with no recourse. We fix this."

**[0:30–1:00] The anti-scam guarantee**
Navigate to `/pay/scam.dupont.residence-epfl.eth`
→ Red: "Invalid payment link — no verified lease found for this address"
"A fake QR code resolves to an ENS name with no lease contract. Blocked before any money moves. No trust required — it's on-chain."

**[1:00–2:00] Tenant onboarding**
Navigate to `/onboarding`
→ "Connect with email" → Privy wallet created, no seed phrase
→ "Verify Identity" → verified ✓ → persona.verified written to ENS
→ Show `apt1.dupont.residence-epfl.eth` — "this IS their lease"
→ Show QR code: "this is what the residence emails them each month"

**[2:00–3:30] Payment flow**
Navigate to `/pay/apt1.dupont.residence-epfl.eth`
→ Green "Verified Lease" badge, 1500 USDC due
→ "Mint USDC" → "Approve" → "Pay Rent" → tx confirmed
→ Show tx on https://sepolia.etherscan.io

**[3:30–4:00] Lease termination**
Navigate to `/owner/dashboard`
→ "Simulate Late Payment" → penalty shown on /pay page
→ "Terminate Lease" → tx confirmed
→ Navigate back to `/pay/apt1.dupont.residence-epfl.eth` → now "Invalid payment link"
"The ENS subname was deleted on-chain. The lease is verifiably over."

**[4:00–5:00] Identity layer**
Open https://app.ens.domains on Sepolia → search `apt1.dupont.residence-epfl.eth`
→ Shows all text records: lease terms, persona.verified=true
"Any ENS-aware app can verify this lease without our frontend. The identity travels with the tenant."

---

## What to Mock vs What Must Work Live

### Must work live on Sepolia
- ENS subname creation on `createLease()` with text records set
- `apt1.dupont.residence-epfl.eth` resolves to tenant address in frontend
- MockUSDC transfer from tenant to owner on `payRent()`
- Penalty calculation showing correct late amount
- ENS subname deletion on `terminateLease()` — name stops resolving
- `/pay/[ensName]` anti-scam rejection for non-existent names

### Can be mocked / simplified
- Persona KYC — fake flow, but ENS text record write is real
- PM onboarding UI — keep as setup script, explain verbally to judges
- Payment scheduling — show current state only, no cron jobs
- Mobile responsive design — demo on laptop
- Multi-month penalty accrual — demo one month, explain the pattern

---

## Quick Reference

### Namehashes (compute once, hardcode in .env)
```typescript
import { namehash } from 'viem/ens';

namehash('residence-epfl.eth')              // NEXT_PUBLIC_PARENT_NODE
namehash('dupont.residence-epfl.eth')       // owner node
namehash('apt1.dupont.residence-epfl.eth')  // lease node
```

### ENS function signatures
```
NameWrapper:
  setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver,
                   uint64 ttl, uint32 fuses, uint64 expiry) → bytes32
  setSubnodeOwner(bytes32 parentNode, string label, address newOwner,
                  uint32 fuses, uint64 expiry) → bytes32
  setApprovalForAll(address operator, bool approved)
  isApprovedForAll(address account, address operator) → bool

PublicResolver:
  setText(bytes32 node, string key, string value)
  text(bytes32 node, string key) → string
  setAddr(bytes32 node, address addr)
  addr(bytes32 node) → address
```

### Cast command fallbacks (if frontend breaks during demo)
```bash
# Check NameWrapper approval
cast call 0x0635513f179D50A207757E05759CbD106d7dFcE8 \
  "isApprovedForAll(address,address)(bool)" \
  $PM_ADDRESS $LEASE_MANAGER_ADDRESS \
  --rpc-url $SEPOLIA_RPC

# Read text record
cast call 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD \
  "text(bytes32,string)(string)" \
  $LEASE_NODE "lease.status" \
  --rpc-url $SEPOLIA_RPC

# Get total due
cast call $LEASE_MANAGER_ADDRESS \
  "getTotalDue(uint256)(uint256)" \
  0 --rpc-url $SEPOLIA_RPC
```

### Useful links
- ENS Manager App (Sepolia): https://app.ens.domains (switch network to Sepolia)
- Sepolia ETH faucet: https://sepolia-faucet.pk910.de
- Alchemy faucet: https://www.alchemy.com/faucets/ethereum-sepolia
- Sepolia Etherscan: https://sepolia.etherscan.io
- ENS Sepolia addresses: https://discuss.ens.domains/t/testnet-deployment-addresses-holesky-and-sepolia/18667
- Privy docs: https://docs.privy.io/guide/react/wallets/embedded
- Foundry book: https://book.getfoundry.sh
- wagmi v2: https://wagmi.sh
- viem ENS: https://viem.sh/docs/ens
