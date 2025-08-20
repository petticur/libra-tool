# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript CLI tool for Libra that uses Commander.js for subcommand support. The application is structured to be extensible with new subcommands.

## Development Commands

### Build and Run
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript (outputs to dist/)
- `npm run dev` - Run TypeScript directly with tsx (for development)
- `npm start` - Run the compiled JavaScript

### Code Quality
- `npm run typecheck` - Type-check without building
- `npm run lint` - Run ESLint on TypeScript files
- `npm run clean` - Remove build artifacts

### Testing the CLI
- `node dist/index.js [command]` - Run specific commands after building
- `npm run dev -- [command]` - Run commands in development mode

### Available Commands
- `libra-tool version` - Display version number
- `libra-tool block-number` - Get current block number from mainnet (default)
- `libra-tool block-number --testnet` - Get current block number from testnet
- `libra-tool vouches <address>` - Get received vouches for an account (mainnet by default)
- `libra-tool vouches <address> --testnet` - Get received vouches from testnet

The vouches command accepts addresses with or without "0x" prefix and returns a formatted JSON array of vouchers with their addresses and epochs.

## Code Style Guidelines

### Formatting Rules
- **No trailing whitespace**: Never add spaces or tabs at the end of lines
- Follow existing indentation patterns (2 spaces for TypeScript)
- Maintain consistent code formatting throughout the project

## Architecture

### Core Structure
- `src/index.ts` - Main CLI entry point using Commander.js (simplified orchestrator)
- `src/commands/` - Individual command implementations
  - `block-number.ts` - Block number command
  - `vouches.ts` - Vouches command
  - `vouch-graph.ts` - Vouch graph command
  - `get-roots.ts` - Get roots command
- `src/utils/` - Utility modules
  - `address.ts` - Address validation and formatting
  - `name-mapping.ts` - Name mapping loading and management
  - `graph.ts` - Mermaid graph generation
  - `scoring.ts` - Trust score calculation
  - `vouching.ts` - Vouch fetching and graph walking

### Adding New Subcommands
1. Create a new file in `src/commands/` (e.g., `my-command.ts`)
2. Export a registration function that takes the Commander program instance:
```typescript
export function registerMyCommand(program: Command) {
  program
    .command('my-command')
    .description('Description of command')
    .action(async () => {
      // Implementation
    });
}
```
3. Import and call the registration function in `src/index.ts`

### Key Dependencies
- `commander` - CLI framework for parsing arguments and subcommands
- `typescript` - Type safety and modern JavaScript features
- `tsx` - Fast TypeScript execution for development
- `open-libra-sdk` - TypeScript SDK for interacting with the Open Libra blockchain

## Open Libra SDK Integration

The project uses `open-libra-sdk` v1.1.5 for blockchain interactions. Key components:

### Main Classes
- `LibraClient` - Blockchain interaction client
- `LibraWallet` - Wallet management and transactions
- `Network` - Network selection (MAINNET/TESTNET)

### Common SDK Usage Patterns
```typescript
import { LibraWallet, Network } from 'open-libra-sdk';

// Create wallet from mnemonic
const wallet = LibraWallet.fromMnemonic(mnemonic, Network.TESTNET);

// Get ledger info
const ledgerInfo = await wallet.client?.getLedgerInfo();

// Build and submit transactions
const tx = await wallet.buildTransferTx(recipientAddress, amount);
const result = await wallet.signSubmitWait(tx);
```