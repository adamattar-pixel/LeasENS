'use client';

import { useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { isInjectedConnector } from '@/lib/privy';

type WalletRole = 'tenant' | 'owner' | 'pm';

export function WalletConnect({
  role,
  title,
  description,
}: {
  role: WalletRole;
  title: string;
  description: string;
}) {
  const { login } = usePrivy();
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const injectedConnector = useMemo(
    () => connectors.find((candidate) => isInjectedConnector(candidate)),
    [connectors]
  );

  const requiresInjected = role !== 'tenant';
  const hasInjectedWallet = Boolean(injectedConnector);
  const connectedWithInjected = isInjectedConnector(connector);
  const needsInjectedSwitch = requiresInjected && isConnected && !connectedWithInjected;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 mb-6">{description}</p>

      {isConnected && address && !needsInjectedSwitch && (
        <div className="bg-blue-50 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
          <p className="font-mono text-sm text-gray-900 break-all">{address}</p>
        </div>
      )}

      {!requiresInjected && (
        <button
          onClick={login}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Connect with Email
        </button>
      )}

      {requiresInjected && !hasInjectedWallet && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          No injected wallet detected. Install MetaMask (or another injected wallet) and refresh.
        </div>
      )}

      {requiresInjected && hasInjectedWallet && (
        <button
          onClick={() => connect({ connector: injectedConnector })}
          disabled={isPending}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          {needsInjectedSwitch ? 'Switch to Injected Wallet' : 'Connect Injected Wallet'}
        </button>
      )}

      {(isConnected || needsInjectedSwitch) && (
        <button
          onClick={() => disconnect()}
          className="w-full mt-3 border border-gray-300 text-gray-700 hover:bg-blue-50 font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

