#!/usr/bin/env node

import { Command } from 'commander';
import { LibraClient, Network, LibraViews, MoveValue } from 'open-libra-sdk';
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
      // Validate address format
      // Remove 0x prefix if present
      const addressWithoutPrefix = address.replace(/^0x/i, '');
      
      // Check if address contains only hexadecimal characters
      if (!/^[0-9A-Fa-f]+$/.test(addressWithoutPrefix)) {
        console.error('Error: Address must contain only hexadecimal characters (0-9, A-F)');
        process.exit(1);
      }
      
      // Check if address is 32 or 64 characters long
      if (addressWithoutPrefix.length !== 32 && addressWithoutPrefix.length !== 64) {
        console.error(`Error: Address must be 32 or 64 characters long (got ${addressWithoutPrefix.length})`);
        process.exit(1);
      }
      
      // Convert 32-char address to 64-char by prepending 32 zeros
      let fullAddress = addressWithoutPrefix;
      if (fullAddress.length === 32) {
        fullAddress = '0'.repeat(32) + fullAddress;
      }
      
      // Normalize address: convert to uppercase
      const normalizedAddress = fullAddress.toUpperCase();
      
      const network = options.testnet ? Network.TESTNET : Network.MAINNET;
      const client = new LibraClient(network);
      
      // Craft the view payload using the sugar function
      const payload = LibraViews.vouch_getReceivedVouches(normalizedAddress);

      // Call the view function (assuming viewJson is available)
      const result = await client.viewJson(payload);
      
      // Format the vouches data if it's in the expected format
      if (Array.isArray(result) && result.length === 2) {
        const [addresses, epochs] = result;
        if (Array.isArray(addresses) && Array.isArray(epochs) && addresses.length == epochs.length) { 
          const vouches = addresses.map((addr: MoveValue, i: number) => ({
            address: addr,
            epoch: epochs[i]
          }));
        console.log(JSON.stringify(vouches, null, 2));
        } else {
          console.error('Unexpected response format:', JSON.stringify(result, null, 2));
          process.exit(1);
        }
      } else {
        console.error('Unexpected response format:', JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Error fetching vouches:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);
