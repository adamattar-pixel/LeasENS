import { sepolia } from 'wagmi/chains';

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    logo: 'https://your-logo-url.com/logo.png',
    appearance: {
      theme: 'light' as const,
      accentColor: '#2563eb',
    },
    loginMethods: ['email', 'wallet'] as const,
    defaultChain: sepolia,
    supportedChains: [sepolia],
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
    },
  },
};
