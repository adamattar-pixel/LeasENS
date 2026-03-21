'use client';

type KycStatus = 'idle' | 'verifying' | 'verified' | 'error';

export function KYCFlow({
  status,
  walletAddress,
  error,
  onVerify,
}: {
  status: KycStatus;
  walletAddress?: string;
  error?: string | null;
  onVerify: () => void;
}) {
  if (status === 'verifying') {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Verifying identity...</p>
        <p className="text-xs text-gray-400 mt-2">Writing persona.verified to ENS text record</p>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="text-center py-6">
        <div className="text-green-500 text-5xl mb-3">OK</div>
        <p className="font-semibold text-green-700 text-lg mb-1">Identity Verified</p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          persona.verified = true
        </span>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <p className="text-gray-600 mb-2">Verify your identity to complete onboarding.</p>
        <p className="text-xs text-gray-400">
          This writes <span className="font-mono">persona.verified=true</span> to your ENS record.
        </p>
      </div>

      {walletAddress && (
        <p className="text-xs text-gray-400 mb-4">
          Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={onVerify}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
      >
        {status === 'error' ? 'Retry Verification' : 'Verify Identity'}
      </button>
    </div>
  );
}

