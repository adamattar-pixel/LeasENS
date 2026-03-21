# Contracts (Foundry)

Smart contracts for ENS lease lifecycle:
- `LeaseManager.sol` (owner onboarding, lease creation, pay, penalty, terminate, KYC text updates)
- `MockUSDC.sol` (6-decimal mintable test token)

## Setup

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge build
forge test
```

## Env

Create `contracts/.env` from `contracts/.env.example`:

```env
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
LEASE_MANAGER_ADDRESS=0xYOUR_LEASE_MANAGER
PARENT_ENS_NAME=residence-epfl.eth
```

## Useful Commands

```bash
forge build
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast
forge script script/SetupENS.s.sol:SetupENS --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast --sig "run(address)" <LEASE_MANAGER_ADDRESS>
```
