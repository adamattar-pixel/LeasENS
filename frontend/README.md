# Frontend (Next.js App Router)

This frontend implements the ENS lease payment architecture defined in `CLAUDE.md`.

## Role Wallet Policy

- Tenant routes (`/onboarding`, `/pay/*`, `/tenant/*`): Privy embedded wallet/email login.
- Owner/PM routes (`/owner/*`, `/onboard/add-owner`): injected wallet only.

Email-only sessions are blocked from owner/PM actions.

## Structure

- `app/` route entrypoints
- `components/` reusable UI primitives (`WalletConnect`, `PaymentCard`, `LeaseCard`, `KYCFlow`, `QRCode`, `TransactionStatus`)
- `hooks/` shared state/data logic (`useLease`, `usePayRent`, `useENSProfile`)
- `lib/` chain/config/auth helpers (`contracts`, `ens`, `wagmi`, `privy`)

## Run

```bash
npm install
npm run dev
```

## Required Env (`.env.local`)

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
