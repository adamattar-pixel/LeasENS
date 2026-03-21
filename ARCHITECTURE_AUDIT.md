# Architecture Compliance Audit Against `CLAUDE.md` (Strict Parity)

## 1. Scope and Method

- Baseline audited: current local `main` working tree.
- Source of truth: `CLAUDE.md` only.
- Audit scope: `contracts/`, `frontend/`, `scripts/`, and top-level docs.
- Excluded as architecture sources: generated/vendor artifacts (`.next`, `node_modules`, `contracts/lib`, `contracts/out`, `contracts/cache`).

Method used:
1. Extract binding requirements from `CLAUDE.md` with line anchors.
2. Reconstruct implemented architecture from source files and route entry points.
3. Compare requirement-by-requirement and classify divergences.
4. Produce concrete remediation with exact file/module targets.

---

## 2. Target Architecture Extracted from `CLAUDE.md`

## 2.1 System design and boundaries

- Monorepo with `contracts` + `frontend`; backend logic lives only in Next API routes (`CLAUDE.md:41`, `CLAUDE.md:104-159`).
- Single lifecycle contract (`LeaseManager.sol`) handling owner onboarding, lease creation, rent payment, penalties, termination, and KYC text writes (`CLAUDE.md:30`, `CLAUDE.md:236-238`).
- Subname ownership Option A: contract retains lease subname ownership to update ENS text records (`CLAUDE.md:31`, `CLAUDE.md:238`).
- Security guarantee: fake ENS payment links must be blocked by on-chain resolution + lease validity checks (`CLAUDE.md:11-13`).

## 2.2 Role model and wallet strategy

- Tenant wallet: Privy embedded/email (`CLAUDE.md:32`, `CLAUDE.md:851-857`).
- Owner/PM wallet: MetaMask/injected EOA (`CLAUDE.md:33`, `CLAUDE.md:886`, `CLAUDE.md:919`).

## 2.3 Required repository structure

- Explicit required files/modules under `frontend/components`, `frontend/hooks`, and `frontend/lib`:
  - `WalletConnect.tsx`, `PaymentCard.tsx`, `LeaseCard.tsx`, `KYCFlow.tsx`, `QRCode.tsx`, `TransactionStatus.tsx`
  - `useLease.ts`, `usePayRent.ts`, `useENSProfile.ts`
  - `ens.ts`, `contracts.ts`, `wagmi.ts`, `privy.ts`
  (`CLAUDE.md:139-154`).

## 2.4 Core flow requirements

- `/pay/[ensName]` must:
  - block invalid ENS links,
  - fetch ENS records + `getTotalDue(leaseId)`,
  - show verified lease status,
  - always expose mint button for demo,
  - resolve `leaseId` by matching `leaseNode == namehash(ensName)` from tenant leases (`CLAUDE.md:860-873`).
- `/owner/create-lease` must gate by `isApprovedForAll` and set gas to `600000` (`CLAUDE.md:887-895`).
- `/owner/dashboard` and `/tenant/dashboard` must display payment history counts; tenant card must include `persona.verified` badge (`CLAUDE.md:900-914`).
- `/verify` must require no wallet and expose lease verification from ENS (`CLAUDE.md:875-881`).
- `/onboarding` must initiate mock KYC then call webhook to trigger `setPersonaVerified` (`CLAUDE.md:851-857`).

## 2.5 Must-do constraints

- `LeaseManager` must inherit `ERC1155Holder` (`CLAUDE.md:240`, `CLAUDE.md:591`).
- Create-lease UI must use explicit gas limit `600,000` (`CLAUDE.md:371`, `CLAUDE.md:592`, `CLAUDE.md:894`).
- Owner flow must gate on NameWrapper operator approval (`CLAUDE.md:739`, `CLAUDE.md:887-889`, `CLAUDE.md:923-925`).
- ENS Universal Resolver override must be configured in `wagmi.ts` and `ens.ts` (`CLAUDE.md:596`, `CLAUDE.md:773-810`).

---

## 3. Implemented Architecture Snapshot (Current Code)

## 3.1 Contracts

- `LeaseManager` is a single lifecycle contract and inherits `ERC1155Holder` (`contracts/src/LeaseManager.sol:9`).
- Constructor includes backend wallet; `setPersonaVerified` is restricted by `onlyBackend` (`contracts/src/LeaseManager.sol:15`, `contracts/src/LeaseManager.sol:58-69`, `contracts/src/LeaseManager.sol:257-260`).
- Additional state not in spec skeleton: `ownerLabels` mapping (`contracts/src/LeaseManager.sol:40`, `contracts/src/LeaseManager.sol:96`).
- Create lease, pay, penalty, terminate, history, owner/tenant lease indexes are implemented (`contracts/src/LeaseManager.sol:106-300`).

## 3.2 Frontend routes

- Required routes exist: `/`, `/onboarding`, `/onboard/add-owner`, `/owner/*`, `/tenant/dashboard`, `/pay/[ensName]`, `/verify`.
- `/pay/[ensName]` validates ENS, resolves leaseId via `findLeaseIdByEnsName`, supports mint+approve+pay flow (`frontend/app/pay/[ensName]/page.tsx:129-163`, `frontend/lib/ens.ts:50-79`, `frontend/app/pay/[ensName]/page.tsx:119-127`, `frontend/app/pay/[ensName]/page.tsx:196-233`).
- `/owner/create-lease` gates on `isApprovedForAll` and sets gas `600000` (`frontend/app/owner/create-lease/page.tsx:31-37`, `frontend/app/owner/create-lease/page.tsx:99`).
- `/verify` is public and wallet-free (`frontend/app/verify/page.tsx:79-87`).

## 3.3 API routes

- `POST /api/kyc/initiate` returns UUID sessionId (`frontend/app/api/kyc/initiate/route.ts:26-29`).
- `POST /api/kyc/webhook` calls on-chain `setPersonaVerified(namehash(ensName))` with backend key (`frontend/app/api/kyc/webhook/route.ts:30-57`).
- `GET /api/qr/[ensName]` returns PNG QR for `/pay/${ensName}` (`frontend/app/api/qr/[ensName]/route.ts:9-25`).

---

## 4. Mismatch Table (Strict Parity)

| Area | Expected in claude.md | Current implementation | Severity | Recommended fix |
|---|---|---|---|---|
| Role wallet boundary (Owner/PM) | Owner/PM must use MetaMask/injected EOA (`CLAUDE.md:33`, `CLAUDE.md:886`, `CLAUDE.md:919`) | Owner/PM pages depend on `usePrivy()` login flow; global provider allows email login for all roles (`frontend/app/providers.tsx:21`, `frontend/app/owner/create-lease/page.tsx:17`, `frontend/app/owner/dashboard/page.tsx:10`, `frontend/app/onboard/add-owner/page.tsx:17`) | major | Enforce injected-only flow on owner/PM routes. Keep Privy embedded flow for tenant-only routes. |
| Required frontend module structure | `components` must include WalletConnect/PaymentCard/LeaseCard/KYCFlow/QRCode/TransactionStatus (`CLAUDE.md:139-145`) | Only `TransactionStatus.tsx` exists; other required component files missing | major | Add missing component files and move inline card/UI logic out of page files. |
| Required hooks structure | Must include `useLease`, `usePayRent`, `useENSProfile` (`CLAUDE.md:151-154`, `CLAUDE.md:1025`) | Only `useLease.ts` exists; `usePayRent.ts` and `useENSProfile.ts` missing (`frontend/hooks`) | major | Implement missing hooks and migrate `/pay` + ENS profile logic into them. |
| Required `lib/privy.ts` module | `frontend/lib/privy.ts` required (`CLAUDE.md:150`) | File missing; Privy config is embedded in `app/providers.tsx` | major | Create `frontend/lib/privy.ts` and centralize Privy config/utilities there. |
| Tenant dashboard identity requirement | Tenant cards must include persona.verified badge (`CLAUDE.md:911`) | Tenant dashboard renders lease/payment fields but no persona badge (`frontend/app/tenant/dashboard/page.tsx:212-274`) | major | Read persona text record (via ENS helper/hook) and show required badge on each tenant lease card. |
| Three-tier naming consistency | Hierarchy is PM -> Owner -> Tenant (`CLAUDE.md:38`, `CLAUDE.md:71-75`) | Multiple two-tier fallbacks remain; name composition can drop owner label (`frontend/app/onboarding/page.tsx:67-69`, `frontend/app/owner/dashboard/page.tsx:242-244`, `frontend/app/tenant/dashboard/page.tsx:202-204`) | major | Remove two-tier fallback paths for production/demo flow; enforce owner-label-aware three-tier naming and fail loudly when owner context missing. |
| `/pay` required lease trust signal | Display includes green "Verified Lease" badge (`CLAUDE.md:865`) | Page shows only "Identity Verified" badge when persona exists (`frontend/app/pay/[ensName]/page.tsx:287-291`) | minor | Add explicit verified lease badge when ENS + contract checks pass. |
| `/pay` mint button criticality | Mint 10,000 USDC button is critical demo affordance (`CLAUDE.md:867-868`, `CLAUDE.md:597`) | Mint button is hidden unless connected and balance query is active (`frontend/app/pay/[ensName]/page.tsx:339-356`) | minor | Keep mint CTA visible in ready/no-wallet states (connect prompt + mint intent), not only inside connected balance panel. |
| Landing IA parity | Landing should have two buttons: Tenant and Owner (`CLAUDE.md:849`) | Landing has three persona cards including PM (`frontend/app/page.tsx:23-72`) | minor | Align IA to spec or update `CLAUDE.md` to reflect PM-first landing as intended architecture. |
| Setup script parity | `setup-ens.ts` should include parent-namehash output + documented operator flow (`CLAUDE.md:689-716`, `CLAUDE.md:739`) | Script only checks/sets operator approval; no parent-node computation/output (`scripts/setup-ens.ts:37-83`) | major | Extend script to compute and print `namehash(PARENT_ENS_NAME)` and align output with env setup steps in spec. |
| Verification script architecture drift | Architecture assumes owner subname context in three-tier flow (`CLAUDE.md:38`, `CLAUDE.md:69-74`) | `verify-checkpoint.mjs` creates lease directly under root parent (`scripts/verify-checkpoint.mjs:110-140`) | major | Update checkpoint script to follow PM->owner->tenant path or clearly mark as isolated non-architecture smoke test. |
| Docs architecture parity (root README) | Three-tier examples and role boundaries should match spec (`CLAUDE.md:38`, `CLAUDE.md:71-75`) | README uses two-tier lease examples and global Privy wording (`README.md:7`, `README.md:22`, `README.md:40`, `README.md:130`) | major | Rewrite README examples and wallet-role text to strict three-tier + role-specific wallet model. |
| Docs quality parity (frontend/contracts README) | Project docs should describe this architecture, not templates (`CLAUDE.md:3`, `CLAUDE.md:104-159`) | `frontend/README.md` is default create-next-app template; `contracts/README.md` still references `Counter` deploy command (`frontend/README.md:1-35`, `contracts/README.md:61`) | minor | Replace template docs with project-specific setup, flows, and command references. |
| Separation of concerns in page files | Structure implies reusable component/hook boundaries (`CLAUDE.md:139-154`) | `LeaseCard` and `TenantLeaseCard` are embedded inside page modules; shared `useLease`/`TransactionStatus` are currently unused (`frontend/app/owner/dashboard/page.tsx:165-353`, `frontend/app/tenant/dashboard/page.tsx:139-274`, `frontend/hooks/useLease.ts`, `frontend/components/TransactionStatus.tsx`) | major | Extract card components and adopt shared hooks/components consistently. |
| Contract surface strict parity | Spec skeleton does not include `ownerLabels` mapping (`CLAUDE.md:281-287`) | Contract + ABI expose `ownerLabels` as extra surface (`contracts/src/LeaseManager.sol:40`, `frontend/lib/contracts.ts:207-212`) | minor | Either document this extension in `CLAUDE.md` or remove it and derive owner labels by deterministic naming/context. |
| KYC backend-path test coverage | Architecture includes backend-gated `setPersonaVerified` (`CLAUDE.md:503-507`, `CLAUDE.md:940-945`) | Contract tests do not cover `setPersonaVerified` success/failure paths | minor | Add Foundry tests for onlyBackend enforcement and text-write behavior. |

---

## 5. Missing, Extra, Misplaced

## 5.1 Missing (required but absent)

- `frontend/components/WalletConnect.tsx`
- `frontend/components/PaymentCard.tsx`
- `frontend/components/LeaseCard.tsx`
- `frontend/components/KYCFlow.tsx`
- `frontend/components/QRCode.tsx`
- `frontend/hooks/usePayRent.ts`
- `frontend/hooks/useENSProfile.ts`
- `frontend/lib/privy.ts`

## 5.2 Extra (present but outside strict target structure)

- `scripts/verify-checkpoint.mjs` (useful, but not in required structure and currently diverges from three-tier architecture).
- `ownerLabels` on-chain mapping and ABI surface (extension not defined in target skeleton).

## 5.3 Misplaced/coupled incorrectly

- Lease card UI logic is embedded in route pages instead of `components/LeaseCard.tsx`.
- Pay flow state machine and tx sequencing are embedded in route page instead of `hooks/usePayRent.ts`.
- Privy configuration is embedded in `app/providers.tsx` instead of `lib/privy.ts`.
- ENS profile composition logic is duplicated in multiple pages instead of a shared ENS profile hook/helper.

---

## 6. Consistency Scorecard

| Dimension | Status | Notes |
|---|---|---|
| Architecture | partial | Core flow works, but role-wallet boundary and module structure drift are significant. |
| Naming | partial | Three-tier naming not consistently enforced; two-tier fallbacks/docs remain. |
| File/folder organization | partial | Core routes exist, but required component/hook/lib modules are missing. |
| Dependency boundaries | partial | API/contract boundary is good; auth boundary across roles is not. |
| Data flow | partial | `/pay` flow is robust; tenant persona signal not propagated to dashboard cards. |
| State management | partial | Heavy route-local logic; shared hooks/components underused or missing. |
| Smart contract vs frontend responsibilities | mostly aligned | Contract lifecycle responsibilities are correct; frontend role/auth handling diverges. |
| ENS logic placement | partial | `lib/ens.ts` is correct base, but ENS profile/name composition is scattered. |
| Onboarding/verification/payment placement | mostly aligned | Route placement is correct; some strict UX/spec details still missing. |

---

## 7. Remediation Plan

## 7.1 Priority order

1. Enforce role wallet boundaries (owner/PM injected wallets only).
2. Restore strict module boundaries (`components`, `hooks`, `lib/privy`).
3. Fix three-tier naming consistency and persona badge propagation.
4. Align setup/checkpoint scripts with architecture.
5. Bring docs to strict parity.

## 7.2 Quick fixes (high impact, low effort)

1. Add explicit verified lease badge and always-visible mint CTA behavior on `/pay`.
   - Files: `frontend/app/pay/[ensName]/page.tsx`.
2. Add persona.verified badge to tenant cards.
   - Files: `frontend/app/tenant/dashboard/page.tsx`, `frontend/lib/ens.ts` (or new hook).
3. Remove two-tier placeholders/examples in UI/docs.
   - Files: `frontend/app/verify/page.tsx`, `README.md`.
4. Add KYC backend-path tests.
   - Files: `contracts/test/LeaseManager.t.sol`.

## 7.3 Deeper refactors (structural corrections)

1. Split auth by role and enforce wallet policy:
   - Tenant routes: Privy embedded wallet.
   - Owner/PM routes: injected connector only.
   - Files: `frontend/app/providers.tsx`, `frontend/lib/privy.ts` (new), `frontend/app/owner/*`, `frontend/app/onboard/add-owner/page.tsx`.
2. Implement missing architecture modules and move inline logic:
   - New: `frontend/components/WalletConnect.tsx`, `PaymentCard.tsx`, `LeaseCard.tsx`, `KYCFlow.tsx`, `QRCode.tsx`
   - New: `frontend/hooks/usePayRent.ts`, `frontend/hooks/useENSProfile.ts`
   - Refactor: `frontend/app/pay/[ensName]/page.tsx`, `frontend/app/onboarding/page.tsx`, `frontend/app/owner/dashboard/page.tsx`, `frontend/app/tenant/dashboard/page.tsx`.
3. Unify ENS profile derivation and enforce three-tier naming:
   - Files: `frontend/lib/ens.ts`, `frontend/hooks/useENSProfile.ts` (new), affected pages above.
4. Align scripts with architecture narrative:
   - Files: `scripts/setup-ens.ts`, `scripts/verify-checkpoint.mjs`.
5. Update docs to architecture truth:
   - Files: `README.md`, `frontend/README.md`, `contracts/README.md`.

## 7.4 Target structure (strict parity)

```
frontend/
  components/
    WalletConnect.tsx
    PaymentCard.tsx
    LeaseCard.tsx
    KYCFlow.tsx
    QRCode.tsx
    TransactionStatus.tsx
  hooks/
    useLease.ts
    usePayRent.ts
    useENSProfile.ts
  lib/
    ens.ts
    contracts.ts
    wagmi.ts
    privy.ts
```

---

## 8. Final Verdict

- Compliance score: **6.3 / 10**
- Alignment class: **partially aligned**

Rationale:
- Core contract and route coverage are substantially in place, and core anti-scam pay flow is implemented correctly.
- Strict architecture parity still fails on role wallet boundaries, required module structure, naming consistency, and script/docs alignment.

Top 5 actions to restore alignment fastest:
1. Enforce owner/PM injected-wallet-only auth boundary.
2. Implement missing `components/`, `hooks/`, and `lib/privy.ts` modules and refactor page-local logic into them.
3. Enforce three-tier naming everywhere (remove two-tier fallbacks/examples).
4. Add tenant persona.verified badge and shared ENS profile hook.
5. Align setup/checkpoint scripts and all README files to `CLAUDE.md` behavior.

