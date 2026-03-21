# ENS Lease Pay

On-chain rental payments secured by ENS subnames. Built for the StableCoins & Payments Hackathon (BSA x EPFL, ENS Track).

## Anti-Scam Guarantee

Every lease is an ENS subname (e.g., `apt1.residence-epfl.eth`) with on-chain text records. When a tenant scans a payment QR code:

1. The app resolves the ENS name on-chain
2. If the name **doesn't exist** or has **no active lease** → payment is blocked
3. If it exists → rent amount, due date, and tenant identity are read directly from the blockchain

**Fake QR code? ENS name doesn't exist. Payment blocked.** No off-chain database, no middlemen, no way to forge a payment link.

## Architecture

Three-tier hierarchy using ENS subnames:

```
residence-epfl.eth                    (Property Manager)
├── dupont.residence-epfl.eth         (Owner — registered by PM)
│   └── apt1.residence-epfl.eth       (Lease — created by Owner)
└── martin.residence-epfl.eth         (Owner)
    └── apt2.residence-epfl.eth       (Lease)
```

- **Property Manager** registers owners via `registerOwner()` — creates an ENS subname with `role=owner` text record
- **Owner** creates leases via `createLease()` — mints a tenant ENS subname with on-chain text records (status, rent amount, tenant address, dates)
- **Tenant** pays rent via `payRent()` — USDC transfer with automatic late penalty calculation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity, Foundry |
| Blockchain | Ethereum Sepolia testnet |
| ENS | NameWrapper, PublicResolver, subname minting |
| Payment Token | MockUSDC (ERC-20, 6 decimals, permissionless mint) |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Wallet Auth | Privy (email login → embedded wallet) |
| Web3 | wagmi v2, viem |
| QR Codes | `qrcode` npm package |

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| LeaseManager | `0xcAe2921209F419C45fD9cfdbE73e68bA91Ec9962` |
| MockUSDC | `0x6890741124d46B9Bb3f7e90fb65CfB79356dCfcb` |
| NameWrapper | `0x0635513f179D50A207757E05759CbD106d7dFcE8` (Sepolia ENS) |
| PublicResolver | `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD` (Sepolia ENS) |

Parent ENS name: `residence-epfl.eth`

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — anti-scam pitch, three persona CTAs |
| `/onboarding` | Tenant onboarding — email login, mock KYC, QR code |
| `/onboard/add-owner` | Property Manager — register owner subnames |
| `/owner/dashboard` | Owner — list leases, terminate, simulate late payment |
| `/owner/create-lease` | Owner — create lease with ENS subname |
| `/tenant/dashboard` | Tenant — view lease, mint test USDC, pay link |
| `/pay/[ensName]` | Payment page — ENS verification, USDC payment |
| `/api/qr/[ensName]` | QR code PNG generation |

## Setup

### Prerequisites

- Node.js 18+
- Foundry (for contracts)

### Smart Contracts

```bash
cd contracts
forge build
forge test
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=0xcAe2921209F419C45fD9cfdbE73e68bA91Ec9962
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x6890741124d46B9Bb3f7e90fb65CfB79356dCfcb
NEXT_PUBLIC_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
NEXT_PUBLIC_PRIVY_APP_ID=<YOUR_PRIVY_APP_ID>
NEXT_PUBLIC_PARENT_NODE=0xb037c2333616690a48daa1c695a4b349c28c5e2267f4c8039eb0a2c1eb1f6340
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PARENT_ENS_NAME=residence-epfl.eth
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Script

### 1. Property Manager registers an owner
- Go to `/onboard/add-owner`
- Connect PM wallet (must own `residence-epfl.eth`)
- Approve LeaseManager on NameWrapper (one-time)
- Enter owner address + label (e.g., "dupont") → creates `dupont.residence-epfl.eth`

### 2. Owner creates a lease
- Go to `/owner/create-lease`
- Connect owner wallet
- Approve LeaseManager on NameWrapper (one-time)
- Enter tenant address, label (e.g., "apt1"), rent amount, duration → creates `apt1.residence-epfl.eth`

### 3. Tenant pays rent
- Go to `/onboarding` → email login → mock KYC → get QR code
- Or go directly to `/pay/apt1.residence-epfl.eth`
- Connect wallet, mint test USDC, approve + pay

### 4. Anti-scam demo
- Go to `/pay/fake-apartment.residence-epfl.eth`
- ENS name doesn't exist → **"Invalid Payment Link"** is shown
- Payment is impossible — the anti-scam guarantee in action

### 5. Late payment demo
- Owner clicks "Simulate Late" on dashboard → sets due date to 5 days ago
- Tenant sees penalty accruing on their dashboard
- Payment includes rent + accumulated penalty
