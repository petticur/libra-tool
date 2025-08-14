#!/usr/bin/env node

import { Command } from 'commander';
import { LibraClient, Network, LibraViews, MoveValue } from 'open-libra-sdk';
import { writeFileSync } from 'fs';
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

/**
 * Edge in the vouch graph
 */
interface VouchEdge {
  from: string;
  to: string;
}

/**
 * Shortens an address for display in the graph
 * Shows first 6 and last 4 characters
 */
function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Recursively fetches vouches to build a graph
 */
async function fetchVouchGraph(
  client: LibraClient,
  address: string,
  currentDepth: number,
  maxDepth: number,
  visited: Set<string>,
  edges: VouchEdge[]
): Promise<void> {
  // Check if we've already visited this address (cycle detection)
  if (visited.has(address)) {
    return;
  }
  
  // Check if we've reached max depth
  if (currentDepth >= maxDepth) {
    return;
  }
  
  // Mark address as visited
  visited.add(address);
  
  try {
    // Fetch vouches for current address
    const payload = LibraViews.vouch_getReceivedVouches(address);
    const result = await client.viewJson(payload);
    
    if (Array.isArray(result) && result.length === 2) {
      const [addresses, epochs] = result;
      if (Array.isArray(addresses) && Array.isArray(epochs)) {
        // Process each voucher
        for (const voucherAddr of addresses) {
          const voucherAddress = String(voucherAddr);
          
          // Add edge from voucher to current address
          edges.push({
            from: voucherAddress,
            to: address
          });
          
          // Recursively fetch vouches for this voucher
          await fetchVouchGraph(
            client,
            voucherAddress,
            currentDepth + 1,
            maxDepth,
            visited,
            edges
          );
        }
      }
    }
  } catch (error) {
    // Check for a known error that corresponds to the address not being migrated yet
    if (error instanceof Error && error.message.includes('could not find entry function by 0x1::vouch::get_received_vouches')) {
      console.warn(`Address ${shortenAddress(address)} has not been migrated yet. Skipping...`);
    } else {
    // Log error but continue with other addresses
      console.error(`Warning: Could not fetch vouches for ${shortenAddress(address)}:`,
      error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Generates Mermaid graph markdown from edges
 */
function generateMermaidGraph(edges: VouchEdge[], startAddress: string): string {
  if (edges.length === 0) {
    // If no edges, just show the single node
    return `\`\`\`mermaid
graph TD
    ${startAddress}["0x${shortenAddress(startAddress)}"]
\`\`\`\n`;
  }
  
  // Collect all unique addresses
  const addresses = new Set<string>();
  addresses.add(startAddress);
  edges.forEach(edge => {
    addresses.add(edge.from);
    addresses.add(edge.to);
  });
  
  // Build the Mermaid graph
  let mermaid = '```mermaid\ngraph TD\n';
  
  // Add node definitions with shortened labels
  addresses.forEach(addr => {
    mermaid += `    ${addr}["0x${shortenAddress(addr)}"]\n`;
  });
  
  // Add edges
  edges.forEach(edge => {
    mermaid += `    ${edge.from} --> ${edge.to}\n`;
  });
  
  mermaid += '```\n';
  
  return mermaid;
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

program
  .command('vouch-graph <address>')
  .description('Generate a Mermaid graph of the vouching network for an address')
  .option('-d, --depth <number>', 'Maximum depth to traverse (default: 3)', '3')
  .option('-o, --output <file>', 'Output file path (default: vouch-graph.md)', 'vouch-graph.md')
  .action(async (address: string, options) => {
    try {
      // Validate and normalize the address
      const normalizedAddress = validateAndNormalizeAddress(address);
      
      const globalOptions = program.opts();
      const network = globalOptions.testnet ? Network.TESTNET : Network.MAINNET;
      const client = new LibraClient(network);
      
      const maxDepth = parseInt(options.depth, 10);
      if (isNaN(maxDepth) || maxDepth < 1) {
        console.error('Error: Depth must be a positive number');
        process.exit(1);
      }
      
      console.log(`Fetching vouch graph for ${shortenAddress(normalizedAddress)} with depth ${maxDepth}...`);
      
      // Initialize data structures
      const visited = new Set<string>();
      const edges: VouchEdge[] = [];
      
      // Fetch the graph recursively
      await fetchVouchGraph(
        client,
        normalizedAddress,
        0,
        maxDepth,
        visited,
        edges
      );
      
      console.log(`Found ${visited.size} addresses and ${edges.length} vouching relationships`);
      
      // Generate Mermaid graph
      const mermaidContent = generateMermaidGraph(edges, normalizedAddress);
      
      // Write to file
      writeFileSync(options.output, mermaidContent, 'utf-8');
      console.log(`Mermaid graph written to ${options.output}`);
      console.log(`You can generate a visual graph using: mmdc -i ${options.output} -o graph.png`);
      
    } catch (error) {
      console.error('Error generating vouch graph:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);
