# DUET-BRIDGE

Based on the Celer Network, allow the $DUET token family to transfer between BSC (original chain) and some
EVM-compatible
chains.

note: Currently, to redeem $bDUET for $DUET, it can only be transferred back to the BSC chain for redemption.

## Terminologies:

- **sourceChain**: the chain where token transfer from.
- **originalChain**: the chain where token initial supplied. (for duet token family, it's BSC)
- **destinationChain**: the chain where token transfer to.
- **originalToken**: the token address on originalChain.

## Currently supported chains

See [config/tokens.ts](config/tokens.ts)

## Currently supported tokens

See [config/tokens.ts](config/tokens.ts)

## Add new target chain

1.add new chain for hardhat

[config/defines.ts](config/defines.ts)

```typescript
const CHAINS_ = {
  bsc: {},
  arbitrum: {},
  // ... add new chain
}
```

2.add new target chain
[config/tokens.ts](config/tokens.ts)

```typescript
export const duetConfig: DuetConfig = {
  originalTokens: [
    // DUET
    '0x95EE03e1e2C5c4877f9A298F1C0D6c98698FAB7B',
  ],
  originalChain: 'bsc',
  targetChains: [
    'arbitrum',
    // add new chain here
  ],
}
```

3.deploy new chain

```shell
pnpm run deploy
```

> The deploy script will automatically deploy `DuetBridge` and `PegTokens` on the new chain, and automatically execute
> configuration and verification contracts.

## Add new transferXable tokens

1.Add new token to `tokens.ts`
[config/tokens.ts](config/tokens.ts)

```typescript
export const duetConfig: DuetConfig = {
  originalTokens: [
    // DUET
    '0x95EE03e1e2C5c4877f9A298F1C0D6c98698FAB7B',
    // add new token here
    // Don't forget to add the token name as a comment like above
    // for easy maintenance in the future.
  ],
  // ...
}
```

2.Execute deployment script

```shell
pnpm run deploy
```

> The deployment script will deploy pegToken on all target chains and execute the corresponding configuration and
> verification contracts.
