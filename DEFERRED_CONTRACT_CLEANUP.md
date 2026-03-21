# Deferred Milestone: Contract ABI Strict Cleanup (`ownerLabels` Removal)

This milestone is intentionally deferred. Current deployment remains unchanged.

## Goal

Remove `ownerLabels` from `LeaseManager` to match strict `CLAUDE.md` contract surface, then redeploy and migrate frontend/env references.

## Required Changes

1. Remove `mapping(bytes32 => string) public ownerLabels` from `LeaseManager`.
2. Remove writes to `ownerLabels` in `registerOwner`.
3. Remove `ownerLabels` ABI entry from `frontend/lib/contracts.ts`.
4. Replace all frontend name composition reads that rely on `ownerLabels` with an alternative strict source:
   - event indexing service, or
   - deterministic stored mapping in backend API, or
   - additional on-chain view method explicitly documented in `CLAUDE.md`.

## Redeploy and Migration Checklist

1. Deploy new `LeaseManager` to Sepolia.
2. Update:
   - `NEXT_PUBLIC_LEASE_MANAGER_ADDRESS`
   - `LEASE_MANAGER_ADDRESS`
3. Re-run NameWrapper approval setup for PM and owners.
4. Re-validate critical flows:
   - registerOwner
   - createLease (gas 600000)
   - payRent
   - terminateLease
   - setPersonaVerified via webhook
5. Update README + runbook with new address and migration date.

## Risk Notes

- Existing leases on old contract are not automatically migrated.
- Any frontend logic assuming `ownerLabels` must be removed before cutover.
- Demo readiness depends on owner approval re-execution after redeploy.

