#!/usr/bin/env node

import { Command } from 'commander';
import { LibraClient, Network } from 'open-libra-sdk';
import { version } from '../package.json';

const program = new Command();

program
  .name('libra-tool')
  .description('TypeScript CLI tool for Libra')
  .version(version, '-v, --version', 'display version number');

program
  .command('version')
  .description('Print version number')
  .action(() => {
    console.log(version);
  });

program
  .command('block-number')
  .description('Get the current block number from the Libra blockchain')
  .option('--testnet', 'Use testnet instead of mainnet')
  .action(async (options) => {
    try {
      const network = options.testnet ? Network.TESTNET : Network.MAINNET;
      const client = new LibraClient(network);
      
      const ledgerInfo = await client.getLedgerInfo();
      console.log(ledgerInfo.block_height);
    } catch (error) {
      console.error('Error fetching block number:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('vouches <address>')
  .description('Get received vouches for an account address')
  .option('--testnet', 'Use testnet instead of mainnet')
  .action(async (address: string, options) => {
    try {
      // Normalize address: remove 0x prefix if present and convert to uppercase
      const normalizedAddress = address.replace(/^0x/i, '').toUpperCase();
      
      const network = options.testnet ? Network.TESTNET : Network.MAINNET;
      
      // Make direct API call to view function
      const rpcUrl = network === Network.TESTNET 
        ? 'https://rpc.scan.openlibra.io/v1'
        : 'https://rpc.scan.openlibra.io/v1';
      
      const response = await fetch(`${rpcUrl}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: '0x1::vouch::get_received_vouches',
          type_arguments: [],
          arguments: [normalizedAddress]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${errorText}`);
      }

      const result = await response.json();
      
      // Format the vouches data if it's in the expected format
      if (Array.isArray(result) && result.length === 2) {
        const [addresses, epochs] = result;
        const vouches = addresses.map((addr: string, i: number) => ({
          address: addr,
          epoch: epochs[i]
        }));
        console.log(JSON.stringify(vouches, null, 2));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Error fetching vouches:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);