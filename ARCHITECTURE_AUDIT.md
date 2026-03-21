# Architecture Compliance Audit Against `CLAUDE.md`

> **Audited:** 2026-03-21 — current `main` working tree.
> **Source of truth:** `CLAUDE.md` only.
> **Scope:** `contracts/`, `frontend/`, `scripts/`, top-level docs.
> **Excluded:** `.next`, `node_modules`, `contracts/lib`, `contracts/out`, `contracts/cache`.

> **Note:** The previous version of this file (score 6.3/10) was written before hooks, components, and lib files were built. It incorrectly listed WalletConnect, PaymentCard, LeaseCard, KYCFlow, QRCode, usePayRent, useENSProfile, and lib/privy.ts as "missing". All of those now exist. This version supersedes it.

---

## 1. Target Architecture (from CLAUDE.md)

- Monorepo: `contracts/` + `frontend/`; backend logic in Next.js API routes only.
- Single lifecycle contract `LeaseManager.sol`: owner onboarding, lease creation, rent payment, penalty, termination, KYC text writes.
- Subname ownership Option A: contract retains lease subname permanently to update ENS text records.
- Security guarantee: fake ENS payment links blocked by on-chain resolution + lease validity check.
- Three-tier naming: `apt1.dupont.residence-epfl.eth` (tenant.owner.parent).
- Tenant wallet: Privy embedded/email. Owner/PM wallet: MetaMask/injected EOA.

---

## 2. Required Module Inventory — Current Status

| Required by CLAUDE.md | Status |
|---|---|
| `components/WalletConnect.tsx` | Exists |
| `components/PaymentCard.tsx` | Exists |
| `components/LeaseCard.tsx` | Exists |
| `components/KYCFlow.tsx` | Exists |
| `components/QRCode.tsx` | Exists |
| `components/TransactionStatus.tsx` | Exists |
| `hooks/useLease.ts` | Exists (ownerLabels issue — see §3) |
| `hooks/usePayRent.ts` | Exists, fully used |
| `hooks/useENSProfile.ts` | Exists (ownerLabels-dependent — see §3) |
| `lib/ens.ts` | Matches spec + bonus `findLeaseIdByEnsName` |
| `lib/wagmi.ts` | Exact match with ENS override |
| `lib/contracts.ts` | Match + `ownerLabels` extra entry |
| `lib/privy.ts` | Exists with `isInjectedConnector` helper |
| `types/index.ts` | Exists |
| `app/api/kyc/initiate/route.ts` | Exact match |
| `app/api/kyc/webhook/route.ts` | Real on-chain `setPersonaVerified` tx |
| `app/api/qr/[ensName]/route.ts` | Exact match |
| All 7 required pages | All exist |
| `contracts/script/SetupENS.s.sol` | Exists |
| `scripts/setup-ens.ts` | Exists (missing namehash output — see §3) |

---

## 3. Mismatch Table

| Area | Expected in CLAUDE.md | Current implementation | Severity | Recommended fix |
|---|---|---|---|---|
| Contract: `ownerLabels` mapping | No `ownerLabels` in `LeaseManager` skeleton (CLAUDE.md:281-287) | `mapping(bytes32 => string) public ownerLabels` added; written on every `registerOwner()` call (LeaseManager.sol:40, :96) | MAJOR | Tracked in `DEFERRED_CONTRACT_CLEANUP.md`. Remove post-demo and redeploy. |
| ABI: `ownerLabels` | No `ownerLabels` entry in leaseManagerAbi | `leaseManagerAbi` in `frontend/lib/contracts.ts` exposes `ownerLabels`; hooks call it on-chain | MAJOR | Remove when contract is cleaned up. ABI and contract must co-move. |
| `hooks/useLease.ts` calls `ownerLabels` | `useLease` reads only spec-defined contract surface | `useLease.ts:34-40` calls `ownerLabels(parentNode)` — non-spec function. Hook is not used by any page (pages use inline `useReadContract`) | MAJOR | Unused so no runtime impact now. Refactor when `ownerLabels` is removed. |
| `hooks/useENSProfile.ts` calls `ownerLabels` | ENS name composition comes from `lib/ens.ts` alone | `useENSProfile.ts:31-45` calls `ownerLabels` on-chain to get owner label, then constructs three-tier name | MAJOR | Current necessary workaround. Must be refactored when `ownerLabels` is removed — derive owner label from ENS text records on owner subname instead. |
| KYC onboarding requires pre-existing lease | CLAUDE.md implies KYC happens after email login, independently | `onboarding/page.tsx:56-59`: if `ensProfile.ensName` is null (no lease exists yet), `handleVerifyIdentity` errors with "No strict three-tier ENS lease found" | MAJOR | Add clear message: "Your owner must create a lease for your address before you can complete verification." CLAUDE.md does not address this ordering dependency. |
| `setup-ens.ts` missing namehash output | CLAUDE.md:730-731: script must print namehash for copying into `.env.local` as `NEXT_PUBLIC_PARENT_NODE` | Script prints approval status only — no namehash output (scripts/setup-ens.ts:60-90) | MINOR | Add `console.log('NEXT_PUBLIC_PARENT_NODE=', namehash(parentEnsName))` to script output. |
| `verify-checkpoint.mjs` bypasses three-tier hierarchy | Architecture: PM -> Owner -> Tenant for all lease creation | Script creates lease directly under root `parentNode`, skipping owner subname tier | MINOR | Mark clearly as "flat smoke test, not production flow" or add three-tier path. |
| Two-tier fallback strings in UI | Three-tier naming enforced everywhere (CLAUDE.md:38,75) | `owner/dashboard/page.tsx:257` and `tenant/dashboard/page.tsx:193`: `ensProfile.ensName \|\| \`UNRESOLVED.${lease.label}\`` shows a non-valid ENS placeholder | MINOR | Replace with `"Resolving..."` or a skeleton loader. Never show a fake ENS string. |
| Landing: 3 persona cards vs 2 buttons | CLAUDE.md:849: two CTAs — Tenant and Owner | `page.tsx` has three cards: Tenant, Owner, Property Manager | MINOR | Either remove PM card or document the three-CTA design in CLAUDE.md. PM card aids demo judges. |
| `PersonaVerified` event not in CLAUDE.md | `setPersonaVerified` emits no event in spec skeleton | Implementation emits `PersonaVerified(node, timestamp)` (LeaseManager.sol:55) | NONE — enhancement | Update CLAUDE.md to document it. |
| `findLeaseIdByEnsName` in `lib/ens.ts` | Spec code shows 4 functions; prose at CLAUDE.md:873 implies this logic must exist | Fifth function correctly implements the prose requirement | NONE — compliant | No action needed. |
| `isInjectedConnector` in `lib/privy.ts` | CLAUDE.md lists `privy.ts` as required; no content spec | Extra helper enabling role-based wallet detection across all pages | NONE — enhancement | No action needed. |
| `frontend/README.md` | Should describe the project | Default Next.js "create-next-app" template | MINOR | Replace with project setup and route reference. |
| `contracts/README.md` | Should describe contracts setup | Still references `Counter` deploy example | MINOR | Replace with Foundry commands and contract addresses. |
| Extra root files | Not in CLAUDE.md structure | `ARCHITECTURE_AUDIT.md`, `DEFERRED_CONTRACT_CLEANUP.md`, `scripts/integration-checks.mjs`, `scripts/verify-checkpoint.mjs` | TRIVIAL | Acceptable doc/tooling artifacts. |

---

## 4. Extra Pieces (Present, Not in CLAUDE.md)

All additive — none break the architecture:

- `ownerLabels` on-chain mapping + ABI + hook calls (documented divergence, tracked in `DEFERRED_CONTRACT_CLEANUP.md`)
- `PersonaVerified` event on `setPersonaVerified`
- `findLeaseIdByEnsName` in `lib/ens.ts`
- `isInjectedConnector` in `lib/privy.ts`
- `scripts/integration-checks.mjs`, `scripts/verify-checkpoint.mjs`

---

## 5. Consistency Scorecard

| Dimension | Score | Notes |
|---|---|---|
| Architecture | 8/10 | All tiers present and working; `ownerLabels` is documented debt |
| Naming | 9/10 | Two-tier placeholder strings remain in two card components |
| File/folder organization | 10/10 | Fully matches CLAUDE.md required structure |
| Dependency boundaries | 9/10 | Contract/API/frontend boundaries respected |
| Data flow | 9/10 | `/pay` flow correct; KYC-before-lease edge case unhandled |
| State management | 9/10 | Hooks used correctly throughout; `useLease` is defined but unused by pages |
| Contract vs frontend responsibilities | 9/10 | All ENS writes in contract, all reads in frontend |
| ENS logic placement | 9/10 | `lib/ens.ts` is the single ENS entry point; `useENSProfile` wraps it correctly |
| Three-tier naming | 8/10 | Enforced via `useENSProfile`; two cosmetic fallback strings remain |

---

## 6. Remediation Plan

### Quick fixes (< 30 min each)

1. **Add namehash output to `scripts/setup-ens.ts`**
   Add `console.log('NEXT_PUBLIC_PARENT_NODE=', namehash(parentEnsName))` before the approval check.

2. **Replace two-tier fallback strings**
   `frontend/app/owner/dashboard/page.tsx:257` and `frontend/app/tenant/dashboard/page.tsx:193`
   Change `ensProfile.ensName || \`UNRESOLVED.${lease.label}\`` to `ensProfile.ensName || '...'`

3. **Add no-lease message to `/onboarding` KYC step**
   `frontend/app/onboarding/page.tsx`
   When `!ensProfile.ensName` in KYC step: show "Ask your property owner to create a lease for your address first."

4. **Replace template READMEs**
   `frontend/README.md` and `contracts/README.md`

### Deeper refactors (deferred, post-demo)

1. **Remove `ownerLabels` from contract** — per `DEFERRED_CONTRACT_CLEANUP.md`.
   - Redeploy `LeaseManager`.
   - Remove from ABI in `lib/contracts.ts`.
   - Refactor `useENSProfile` to derive owner label from ENS `owner.address` text record on owner subname, or accept explicit owner label as input.
   - Refactor `useLease` to remove the dead `ownerLabels` call.

2. **Fix `verify-checkpoint.mjs`** — make it follow PM→owner→tenant path or mark clearly as flat smoke test.

---

## 7. Final Verdict

**Compliance score: 8.5 / 10**
**Alignment class: Broadly aligned**

The core anti-scam flow, three-tier ENS hierarchy, contract lifecycle, payment flow, KYC webhook, and all required modules are correctly implemented. The only load-bearing divergence is `ownerLabels`, which is self-documented and deferred. All remaining mismatches are cosmetic or script-level.

**Top 5 actions:**

1. Remove `ownerLabels` from contract + ABI + hooks (post-demo redeploy)
2. Replace two-tier placeholder strings in dashboard card components
3. Add no-lease guard message to `/onboarding` KYC step
4. Add `namehash` output to `setup-ens.ts`
5. Replace template READMEs in `frontend/` and `contracts/`
