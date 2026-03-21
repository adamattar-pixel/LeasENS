import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Must override UniversalResolver for ENS resolution to work on Sepolia
const sepoliaWithENS = {
  ...sepolia,
  contracts: {
    ...sepolia.contracts,
    ensUniversalResolver: {
      address: '0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725' as `0x${string}`,
    },
  },
};

export const wagmiConfig = createConfig({
  chains: [sepoliaWithENS],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
  },
});
