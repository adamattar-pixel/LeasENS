/**
 * Lightweight architecture integration checks.
 *
 * Verifies that critical flow guards still exist in source code:
 * - Invalid pay link blocking
 * - Onboarding KYC initiate/webhook path
 * - Owner create-lease approval gating
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assertContains(content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`FAILED: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

function main() {
  const payPage = read('frontend/app/pay/[ensName]/page.tsx');
  assertContains(payPage, /subnameExists\(/, 'pay page checks ENS existence');
  assertContains(payPage, /Invalid Payment Link/, 'pay page renders invalid-link guard');

  const onboardingPage = read('frontend/app/onboarding/page.tsx');
  assertContains(onboardingPage, /\/api\/kyc\/initiate/, 'onboarding calls kyc initiate');
  assertContains(onboardingPage, /\/api\/kyc\/webhook/, 'onboarding calls kyc webhook');

  const createLeasePage = read('frontend/app/owner/create-lease/page.tsx');
  assertContains(createLeasePage, /isApprovedForAll/, 'owner flow checks NameWrapper approval');
  assertContains(createLeasePage, /Approve LeaseManager/, 'owner flow exposes approval action');

  console.log('All integration checks passed.');
}

main();

