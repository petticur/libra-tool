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
 * - Ensures the address has "0x" prefix
 * - Returns the normalized address in uppercase with "0x" prefix
 *
 * @param address - The input address string
 * @returns The normalized 64-character uppercase address with "0x" prefix
 * @throws Exits the process with error code 1 if validation fails
 */
function validateAndNormalizeAddress(address: string): string {
  // Remove 0x prefix if present for validation
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

  // Normalize address: convert to uppercase and ensure 0x prefix
  return '0x' + fullAddress.toUpperCase();
}

/**
 * Edge in the vouch graph
 */
interface VouchEdge {
  from: string;
  to: string;
}

/**
 * Map to store final accumulated scores for addresses
 */
type ScoreMap = Map<string, number>;

/**
 * Fetches the set of root addresses from the trust registry
 */
async function fetchRootAddresses(client: LibraClient): Promise<string[]> {
  try {
    const payload = LibraViews.rootOfTrust_getCurrentRootsAtRegistry("0x1");
    const result = await client.viewJson(payload);

    // The result should be an array where the first element is an array of addresses
    if (Array.isArray(result)) {
      const rootsArray = result[0];
      if (Array.isArray(rootsArray)) {
        return rootsArray.map(addr => String(addr));
      } else{
        console.error('Unexpected response format from root registry:', result);
        return [];
      }
    } else {
      console.error('Unexpected response format from root registry:', result);
      return [];
    }
  } catch (error) {
    console.error('Error fetching root addresses:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Calculates trust scores for all addresses by walking from root addresses
 * Root addresses start with score 200,000, halved at each hop
 */
async function calculateAddressScores(
  client: LibraClient,
  rootAddresses: Set<string>,
  allAddresses: Set<string>
): Promise<ScoreMap> {
  const scores = new Map<string, number>();
  const ROOT_SCORE = 200000;

  // Initialize all addresses with score 0
  allAddresses.forEach(addr => scores.set(addr, 0));

  // Calculate scores from each root address
  for (const rootAddr of rootAddresses) {

    // Set root score
    scores.set(rootAddr, (scores.get(rootAddr) || 0) + ROOT_SCORE);

    // BFS from this root
    const visited = new Set<string>();
    const queue: Array<{address: string, score: number}> = [{address: rootAddr, score: ROOT_SCORE}];
    visited.add(rootAddr);

    while (queue.length > 0) {
      console.log(`Walking: ${queue.length} addresses left in queue`);
      const {address, score} = queue.shift()!;
      const nextScore = Math.floor(score / 2);

      // Skip if score becomes too small to matter
      if (nextScore < 1) continue;

      try {
        // Fetch who vouches for this address (reverse direction)
        const payload = LibraViews.vouch_getReceivedVouches(address);
        const result = await client.viewJson(payload);

        if (Array.isArray(result) && result.length === 2) {
          const [addresses] = result;
          if (Array.isArray(addresses)) {
            // Process each voucher (who vouches for current address)
            for (const voucherAddr of addresses) {
              const voucherAddress = String(voucherAddr);
              // Add score to voucher if not visited from this root
              if (!visited.has(voucherAddress)) {
                visited.add(voucherAddress);

                // Accumulate score
                const currentScore = scores.get(voucherAddress) || 0;
                scores.set(voucherAddress, currentScore + nextScore);

                // Add to queue for further traversal
                queue.push({address: voucherAddress, score: nextScore});
              }
            }
          }
        }
      } catch (error) {
        // Skip addresses that can't be fetched
        console.warn(`Could not fetch vouches for ${shortenAddress(address)} during scoring`,
          error instanceof Error ? error.message : error);
      }
    }
  }

  return scores;
}

/**
 * Formats a score for display (e.g., 500000 -> "500K")
 */
function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${Math.floor(score / 1000000)}M`;
  } else if (score >= 1000) {
    return `${Math.floor(score / 1000)}K`;
  } else {
    return score.toString();
  }
}

/**
 * Shortens an address for display in the graph
 * Shows "0x" prefix plus first 4 and last 4 characters of the actual address
 */
function shortenAddress(address: string): string {
  // Remove 0x prefix if present for consistent handling
  const cleanAddress = address.replace(/^0x/i, '');
  if (cleanAddress.length <= 8) return '0x' + cleanAddress;
  return `0x${cleanAddress.slice(0, 4)}...${cleanAddress.slice(-4)}`;
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
  edges: VouchEdge[],
  rootAddresses: Set<string>
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

          // Only recurse if this voucher is not a root address
          if (!rootAddresses.has(voucherAddress)) {
            // Recursively fetch vouches for this voucher
            await fetchVouchGraph(
              client,
              voucherAddress,
              currentDepth + 1,
              maxDepth,
              visited,
              edges,
              rootAddresses
            );
          } else {
            // Mark root address as visited to prevent revisiting from other paths
            visited.add(voucherAddress);
          }
        }
      }
    }
  } catch (error) {
    // Log error but continue with other addresses
    console.error(`Warning: Could not fetch vouches for ${shortenAddress(address)} (probably means the RPC node is broken):`,
    error instanceof Error ? error.message : error);
  }
}

/**
 * Generates Mermaid graph markdown from edges
 */
function generateMermaidGraph(edges: VouchEdge[], startAddress: string, rootAddresses: Set<string>, scores: ScoreMap): string {
  if (edges.length === 0) {
    // Check if start address is a root
    const normalizedStart = startAddress.startsWith('0x')
      ? startAddress.toUpperCase()
      : '0x' + startAddress.toUpperCase();
    const isRoot = rootAddresses.has(normalizedStart);

    // If no edges, just show the single node with special styling
    const score = scores.get(normalizedStart) || 0;
    const scoreText = score > 0 ? ` (${formatScore(score)})` : '';
    return `\`\`\`mermaid
graph TD
    ${startAddress}["${shortenAddress(startAddress)}${scoreText}"]
    style ${startAddress} fill:${isRoot ? '#9f9' : '#f9f'},stroke:#333,stroke-width:4px
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

  // Add node definitions with shortened labels and scores
  addresses.forEach(addr => {
    const normalizedAddr = addr.startsWith('0x')
      ? addr.toUpperCase()
      : '0x' + addr.toUpperCase();
    const score = scores.get(normalizedAddr) || 0;
    const scoreText = score > 0 ? ` (${formatScore(score)})` : '';
    mermaid += `    ${addr}["${shortenAddress(addr)}${scoreText}"]\n`;
  });

  // Style the start node differently (pink)
  mermaid += `    style ${startAddress} fill:#f9f,stroke:#333,stroke-width:4px\n`;

  // Style root nodes differently (green)
  addresses.forEach(addr => {
    const normalizedAddr = addr.startsWith('0x')
      ? addr.toUpperCase()
      : '0x' + addr.toUpperCase();
    if (rootAddresses.has(normalizedAddr) && addr !== startAddress) {
      mermaid += `    style ${addr} fill:#9f9,stroke:#333,stroke-width:2px\n`;
    }
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
  .option('--testnet', 'Use testnet instead of mainnet')
  .option('--url <url>', 'Custom RPC endpoint URL');

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
      const client = new LibraClient(network, globalOptions.url || null);

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
      const client = new LibraClient(network, globalOptions.url || null);

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
      const client = new LibraClient(network, globalOptions.url || null);

      const maxDepth = parseInt(options.depth, 10);
      if (isNaN(maxDepth) || maxDepth < 1) {
        console.error('Error: Depth must be a positive number');
        process.exit(1);
      }

      console.log(`Fetching vouch graph for ${shortenAddress(normalizedAddress)} with depth ${maxDepth}...`);

      // Fetch root addresses to constrain the graph walk
      console.log('Fetching root addresses...');
      const rootAddressList = await fetchRootAddresses(client);
      const rootAddresses = new Set<string>(rootAddressList.map(addr => addr));
      console.log(`Found ${rootAddresses.size} root addresses`);

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
        edges,
        rootAddresses
      );

      console.log(`Found ${visited.size} addresses and ${edges.length} vouching relationships`);

      // Collect all unique addresses in the graph
      const allAddresses = new Set<string>();
      allAddresses.add(normalizedAddress);
      edges.forEach(edge => {
        allAddresses.add(edge.from);
        allAddresses.add(edge.to);
      });

      // Calculate trust scores for all addresses
      console.log('Calculating trust scores...');
      const scores = await calculateAddressScores(client, rootAddresses, allAddresses);

      // Generate Mermaid graph with scores
      const mermaidContent = generateMermaidGraph(edges, normalizedAddress, rootAddresses, scores);

      // Write to file
      writeFileSync(options.output, mermaidContent, 'utf-8');
      console.log(`Mermaid graph written to ${options.output}`);
      console.log(`You can generate a visual graph using: mmdc -i ${options.output} -o graph.png`);

    } catch (error) {
      console.error('Error generating vouch graph:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('get-roots')
  .description('Get the current set of root addresses from the trust registry')
  .action(async () => {
    try {
      const globalOptions = program.opts();
      const network = globalOptions.testnet ? Network.TESTNET : Network.MAINNET;
      const client = new LibraClient(network, globalOptions.url || null);

      const rootAddresses = await fetchRootAddresses(client);

      if (rootAddresses.length === 0) {
        console.log('No root addresses found in the registry');
      } else {
        console.log(`Found ${rootAddresses.length} root addresses:`);
        rootAddresses.forEach(addr => {
          // Ensure 0x prefix is present once
          const formattedAddr = addr.startsWith('0x') ? addr : '0x' + addr;
          console.log(`  ${formattedAddr}`);
        });
      }
    } catch (error) {
      console.error('Error fetching root addresses:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);
