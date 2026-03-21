'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from '@privy-io/wagmi';
import { wagmiConfig } from '@/lib/wagmi';
import { useState } from 'react';
import { privyAppId, tenantPrivyConfig } from '@/lib/privy';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider appId={privyAppId} config={tenantPrivyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
