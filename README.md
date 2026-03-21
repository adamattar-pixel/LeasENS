# ENS Lease Pay

On-chain rental payments secured by ENS subnames.

## Core Security Guarantee

A payment link is accepted only if:
1. ENS name resolves on-chain.
2. ENS text records show an active lease.
3. Lease maps to an active contract lease ID.

If any check fails, `/pay/[ensName]` shows `Invalid payment link` and blocks payment.

## Architecture (Strict Three-Tier)

`parent.eth` (PM root) -> `owner.parent.eth` -> `tenant.owner.parent.eth`

Example:
- Owner: `dupont.residence-epfl.eth`
- Lease: `apt1.dupont.residence-epfl.eth`

Role responsibilities:
- PM (injected wallet): registers owner subnames.
- Owner (injected wallet): approves NameWrapper + creates/terminates leases.
- Tenant (Privy embedded wallet): onboarding, KYC mock, rent payment.

## Main Routes

- `/` landing (tenant/owner primary CTAs)
- `/onboarding` tenant onboarding (Privy + mock KYC)
- `/pay/[ensName]` anti-scam payment flow
- `/tenant/dashboard` tenant lease view
- `/owner/create-lease` owner lease creation (gas 600000)
- `/owner/dashboard` owner lease management
- `/onboard/add-owner` PM owner registration
- `/verify` public ENS verification (no wallet required)

API routes:
- `POST /api/kyc/initiate`
- `POST /api/kyc/webhook`
- `GET /api/qr/[ensName]`

## Setup

### Contracts

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge build
forge test
```

Copy `contracts/.env.example` to `contracts/.env` and fill values.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_LEASE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
NEXT_PUBLIC_PRIVY_APP_ID=<YOUR_PRIVY_APP_ID>
NEXT_PUBLIC_PARENT_NODE=0x...
NEXT_PUBLIC_PARENT_ENS_NAME=residence-epfl.eth
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_WALLET_PRIVATE_KEY=0x...
```

Run app:

```bash
npm run dev
```

## Notes

- Owner/PM actions are blocked unless connected via injected wallet.
- Tenant flow uses Privy embedded wallet/email login.
- Contract ABI cleanup (`ownerLabels` removal/redeploy) is deferred by design.
