#!/usr/bin/env node

import { Command } from 'commander';
import { LibraClient, Network, LibraViews, MoveValue } from 'open-libra-sdk';
import { version } from '../package.json';

/**
 * Validates and normalizes a blockchain address.
 * - Accepts addresses with or without "0x" prefix
 * - Validates that the address contains only hexadecimal characters
 * - Validates that the address is 32 or 64 characters long
 * - Converts 32-character addresses to 64 characters by prepending zeros
 * - Returns the normalized address in uppercase
 * 
 * @param address - The input address string
 * @returns The normalized 64-character uppercase address
 * @throws Exits the process with error code 1 if validation fails
 */
function validateAndNormalizeAddress(address: string): string {
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
  return fullAddress.toUpperCase();
}

const program = new Command();

program
  .name('libra-tool')
  .description('TypeScript CLI tool for Libra')
  .version(version, '-v, --version', 'display version number')
  .option('--testnet', 'Use testnet instead of mainnet');

program
  .command('version')
  .description('Print version number')
  .action(() => {
    console.log(version);
  });

program
  .command('block-number')
  .description('Get the current block number from the Libra blockchain')
  .action(async () => {
    try {
      const globalOptions = program.opts();
      const network = globalOptions.testnet ? Network.TESTNET : Network.MAINNET;
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
  .action(async (address: string) => {
    try {
      // Validate and normalize the address
      const normalizedAddress = validateAndNormalizeAddress(address);
      
      const globalOptions = program.opts();
      const network = globalOptions.testnet ? Network.TESTNET : Network.MAINNET;
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
