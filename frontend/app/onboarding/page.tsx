'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract } from 'wagmi';
import { LEASE_MANAGER_ADDRESS, leaseManagerAbi } from '@/lib/contracts';
import { WalletConnect } from '@/components/WalletConnect';
import { KYCFlow } from '@/components/KYCFlow';
import { QRCode } from '@/components/QRCode';
import { useENSProfile } from '@/hooks/useENSProfile';

type OnboardingStep = 'connect' | 'kyc' | 'verifying' | 'verified';

export default function OnboardingPage() {
  const { authenticated, ready: privyReady, user } = usePrivy();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<OnboardingStep>('connect');
  const [kycError, setKycError] = useState<string | null>(null);

  const { data: tenantLeaseIds } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getTenantLeases',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const firstLeaseId =
    tenantLeaseIds && tenantLeaseIds.length > 0 ? tenantLeaseIds[0] : undefined;

  const { data: leaseData } = useReadContract({
    address: LEASE_MANAGER_ADDRESS,
    abi: leaseManagerAbi,
    functionName: 'getLease',
    args: firstLeaseId !== undefined ? [firstLeaseId] : undefined,
    query: { enabled: firstLeaseId !== undefined },
  });

  const leaseSeed = leaseData
    ? {
        parentNode: (leaseData as { parentNode: `0x${string}` }).parentNode,
        label: (leaseData as { label: string }).label,
      }
    : undefined;

  const ensProfile = useENSProfile({
    leaseSeed,
    enabled: !!leaseSeed,
  });

  useEffect(() => {
    if (privyReady && authenticated && isConnected && step === 'connect') {
      setStep('kyc');
    }
  }, [privyReady, authenticated, isConnected, step]);

  async function handleVerifyIdentity() {
    if (!address) {
      setKycError('No wallet connected.');
      return;
    }

    setStep('verifying');
    setKycError(null);

    try {
      // If the tenant already has a lease with an ENS name, write KYC to it.
      // If not (no lease assigned yet), complete KYC without writing to ENS.
      const initiateRes = await fetch('/api/kyc/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          ensName: ensProfile.ensName || '',
        }),
      });
      const initiateData = await initiateRes.json();
      if (!initiateRes.ok || !initiateData.sessionId) {
        throw new Error(initiateData.error || 'Failed to initiate KYC');
      }

      // Only call the webhook if we have an ENS name to write to
      if (ensProfile.ensName) {
        const webhookRes = await fetch('/api/kyc/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: initiateData.sessionId,
            ensName: ensProfile.ensName,
          }),
        });
        const webhookData = await webhookRes.json();
        if (!webhookRes.ok || !webhookData.success) {
          throw new Error(webhookData.error || 'Verification transaction failed');
        }
      }

      setStep('verified');
    } catch (err) {
      setKycError(err instanceof Error ? err.message : 'Verification failed');
      setStep('kyc');
    }
  }

  const paymentLink = ensProfile.ensName
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pay/${ensProfile.ensName}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tenant Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your account to pay rent on-chain</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['Connect', 'Verify', 'Done'] as const).map((label, i) => {
            const stepIndex = step === 'connect' ? 0 : step === 'kyc' ? 1 : 2;
            const isActive = i <= stepIndex;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < stepIndex ? 'OK' : i + 1}
                </div>
                <span className={`text-xs ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                  {label}
                </span>
                {i < 2 && (
                  <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {step === 'connect' && (
          <WalletConnect
            role="tenant"
            title="Connect Tenant Wallet"
            description="Sign in with email to create your embedded wallet."
          />
        )}

        {step === 'kyc' && (
          <KYCFlow
            status={kycError ? 'error' : 'idle'}
            walletAddress={address}
            error={kycError}
            onVerify={handleVerifyIdentity}
          />
        )}

        {step === 'verifying' && (
          <KYCFlow
            status="verifying"
            walletAddress={address}
            error={null}
            onVerify={handleVerifyIdentity}
          />
        )}

        {step === 'verified' && (
          <div className="text-center">
            <KYCFlow status="verified" walletAddress={address} onVerify={handleVerifyIdentity} />

            {ensProfile.ensName ? (
              <div className="page-bg rounded-xl p-4 mb-6 space-y-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Your ENS Subname</p>
                  <p className="font-mono text-blue-600 font-semibold break-all">
                    {ensProfile.ensName}
                  </p>
                </div>

                <QRCode ensName={ensProfile.ensName} />

                {paymentLink && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-500 mb-1">Payment Link</p>
                    <a href={paymentLink} className="text-sm text-blue-600 hover:underline break-all">
                      {paymentLink}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-700">
                  Identity verified! Your property manager will assign your lease subname shortly.
                  Check back at your tenant dashboard once the lease is created.
                </p>
              </div>
            )}

            <a
              href={ensProfile.ensName ? `/pay/${ensProfile.ensName}` : '/tenant/dashboard'}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center"
            >
              {ensProfile.ensName ? 'Go to Payment Page' : 'Go to Dashboard'}
            </a>
          </div>
        )}

        {ensProfile.loading && step !== 'verified' && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Resolving ENS profile...
          </p>
        )}

        {user?.email && step !== 'connect' && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Signed in as {user.email.address}
          </p>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">
            &larr; Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
