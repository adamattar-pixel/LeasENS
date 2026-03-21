import type { Connector } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'placeholder';

export const tenantPrivyConfig = {
  appearance: {
    theme: 'light',
    accentColor: '#2563eb',
  },
  loginMethods: ['email', 'wallet'],
  defaultChain: sepolia,
  supportedChains: [sepolia],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets' as const,
  },
} as const;

export function isInjectedConnector(connector: Connector | null | undefined): boolean {
  if (!connector) return false;
  if (connector.id === 'injected') return true;
  if (connector.type === 'injected') return true;
  return connector.name.toLowerCase().includes('metamask');
}

