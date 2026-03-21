'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract } from 'wagmi';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';

type OnboardingStep = 'connect' | 'kyc' | 'verifying' | 'verified';

export default function OnboardingPage() {
  const { login, authenticated, ready: privyReady, user } = usePrivy();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<OnboardingStep>('connect');
  const [ensSubname, setEnsSubname] = useState<string | null>(null);

  // Fetch tenant leases to find their ENS subname
  const { data: tenantLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTenantLeases',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Fetch first lease details if tenant has leases
  const firstLeaseId = tenantLeaseIds && tenantLeaseIds.length > 0 ? tenantLeaseIds[0] : undefined;
  const { data: leaseData } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getLease',
    args: firstLeaseId !== undefined ? [firstLeaseId] : undefined,
    query: { enabled: firstLeaseId !== undefined },
  });

  // Move to KYC step after wallet connection
  useEffect(() => {
    if (privyReady && authenticated && isConnected && step === 'connect') {
      setStep('kyc');
    }
  }, [privyReady, authenticated, isConnected, step]);

  // Read owner label for three-tier name composition
  const leaseParentNode = leaseData ? (leaseData as { parentNode: string }).parentNode : undefined;
  const { data: ownerLabel } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'ownerLabels',
    args: leaseParentNode ? [leaseParentNode as `0x${string}`] : undefined,
    query: { enabled: !!leaseParentNode },
  });

  // Resolve ENS subname from lease data
  useEffect(() => {
    if (leaseData) {
      const lease = leaseData as {
        parentNode: string;
        leaseNode: string;
        label: string;
        owner: string;
        tenant: string;
        active: boolean;
      };
      if (lease.active && lease.label) {
        const parentName = process.env.NEXT_PUBLIC_PARENT_ENS_NAME || 'residence-epfl.eth';
        if (ownerLabel) {
          setEnsSubname(`${lease.label}.${ownerLabel}.${parentName}`);
        } else {
          setEnsSubname(`${lease.label}.${parentName}`);
        }
      }
    }
  }, [leaseData, ownerLabel]);

  const [kycError, setKycError] = useState<string | null>(null);

  async function handleVerifyIdentity() {
    if (!ensSubname || !address) return;
    setStep('verifying');
    setKycError(null);

    try {
      // Step 1: Initiate KYC session
      const initiateRes = await fetch('/api/kyc/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, ensName: ensSubname }),
      });
      const initiateData = await initiateRes.json();
      if (!initiateRes.ok || !initiateData.sessionId) {
        throw new Error(initiateData.error || 'Failed to initiate KYC');
      }

      // Step 2: Call webhook with sessionId
      const webhookRes = await fetch('/api/kyc/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: initiateData.sessionId, ensName: ensSubname }),
      });
      const webhookData = await webhookRes.json();
      if (!webhookRes.ok || !webhookData.success) {
        throw new Error(webhookData.error || 'Verification transaction failed');
      }

      setStep('verified');
    } catch (e) {
      setKycError(e instanceof Error ? e.message : 'Verification failed');
      setStep('kyc');
    }
  }

  const paymentLink = ensSubname
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pay/${ensSubname}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tenant Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your account to pay rent on-chain</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Connect', 'Verify', 'Done'].map((label, i) => {
            const stepIndex = step === 'connect' ? 0 : step === 'kyc' ? 1 : 2;
            const isActive = i <= stepIndex;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < stepIndex ? '\u2713' : i + 1}
                </div>
                <span className={`text-xs ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Connect Wallet */}
        {step === 'connect' && (
          <div className="text-center">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <p className="text-gray-600 mb-4">
                Sign in with your email to create a secure embedded wallet. No seed phrase needed.
              </p>
            </div>
            <button
              onClick={login}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Connect with Email
            </button>
          </div>
        )}

        {/* Step 2: Mock KYC */}
        {step === 'kyc' && (
          <div className="text-center">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="text-4xl mb-3">&#x1F464;</div>
              <p className="text-gray-600 mb-2">
                Verify your identity to complete onboarding.
              </p>
              <p className="text-xs text-gray-400">
                This writes <span className="font-mono">persona.verified=true</span> to your ENS record.
              </p>
            </div>

            {address && (
              <p className="text-xs text-gray-400 mb-4">
                Wallet: {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            )}

            {kycError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-red-700">{kycError}</p>
              </div>
            )}

            <button
              onClick={handleVerifyIdentity}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {kycError ? 'Retry Verification' : 'Verify Identity'}
            </button>
          </div>
        )}

        {/* Step 2b: Verifying */}
        {step === 'verifying' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Verifying identity...</p>
            <p className="text-xs text-gray-400 mt-2">Writing persona.verified to ENS text record</p>
          </div>
        )}

        {/* Step 3: Verified - Show ENS subname + QR */}
        {step === 'verified' && (
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-3">&#x2714;</div>
            <p className="font-semibold text-green-700 text-lg mb-1">Identity Verified</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 mb-6">
              &#x2713; persona.verified = true
            </span>

            {ensSubname ? (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Your ENS Subname</p>
                  <p className="font-mono text-blue-600 font-semibold">{ensSubname}</p>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500 mb-3">Your Payment QR Code</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${ensSubname}`}
                    alt={`QR code for ${ensSubname}`}
                    className="mx-auto w-48 h-48"
                  />
                </div>

                {paymentLink && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-500 mb-1">Payment Link</p>
                    <a
                      href={paymentLink}
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {paymentLink}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500">
                  No active lease found for your wallet. Ask your property owner to create a lease for you.
                </p>
                {address && (
                  <p className="text-xs font-mono text-gray-400 mt-2">
                    {address}
                  </p>
                )}
              </div>
            )}

            <a
              href={ensSubname ? `/pay/${ensSubname}` : '/tenant/dashboard'}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
            >
              {ensSubname ? 'Go to Payment Page' : 'Go to Dashboard'}
            </a>
          </div>
        )}

        {/* Email display */}
        {user?.email && step !== 'connect' && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Signed in as {user.email.address}
          </p>
        )}

        {/* Nav */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  );
}
