import { Command } from 'commander';
import { LibraClient, Network } from 'open-libra-sdk';
import { writeFileSync } from 'fs';
import { validateAndNormalizeAddress, shortenAddress } from '../utils/address';
import { loadAllNameMappings } from '../utils/name-mapping';
import { VouchEdge, generateMermaidGraph } from '../utils/graph';
import { calculateAddressScores } from '../utils/scoring';
import { fetchRootAddresses, fetchVouchGraph } from '../utils/vouching';

export function registerVouchGraphCommand(program: Command) {
  program
    .command('vouch-graph <address>')
    .description('Generate a Mermaid graph of the vouching network for an address')
    .option('--vouch-depth <number>', 'Maximum depth to traverse for fetching vouches (default: 4)', '4')
    .option('--score-depth <number>', 'Maximum depth to traverse for calculating scores (default: 4)', '4')
    .option('-o, --output <file>', 'Output file path (default: vouch-graph.md)', 'vouch-graph.md')
    .option('--name-mappings <sources...>', 'JSON files or URLs containing address-to-name mappings')
    .option('--no-default-names', 'Disable loading default name mappings')
    .action(async (address: string, options) => {
      try {
        // Validate and normalize the address
        const normalizedAddress = validateAndNormalizeAddress(address);

        const globalOptions = program.opts();
        const network = globalOptions.testnet ? Network.TESTNET : Network.MAINNET;
        const client = new LibraClient(network, globalOptions.url || null);

        const vouchDepth = parseInt(options.vouchDepth, 10);
        const scoreDepth = parseInt(options.scoreDepth, 10);

        if (isNaN(vouchDepth) || vouchDepth < 1) {
          console.error('Error: Vouch depth must be a positive number');
          process.exit(1);
        }

        if (isNaN(scoreDepth) || scoreDepth < 0) {
          console.error('Error: Score depth must be a non-negative number (0 for unlimited)');
          process.exit(1);
        }

        console.log(`Fetching vouch graph for ${shortenAddress(normalizedAddress)} with vouch depth ${vouchDepth} and score depth ${scoreDepth === 0 ? 'unlimited' : scoreDepth}...`);

        // Load name mappings
        const nameSources = options.nameMappings || [];
        const useDefaultNames = options.defaultNames !== false;
        const nameMap = await loadAllNameMappings(nameSources, useDefaultNames);

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
          vouchDepth,
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
        const scores = await calculateAddressScores(client, rootAddresses, allAddresses, scoreDepth);

        // Generate Mermaid graph with scores and names
        const mermaidContent = generateMermaidGraph(edges, normalizedAddress, rootAddresses, scores, nameMap);

        // Write to file
        writeFileSync(options.output, mermaidContent, 'utf-8');
        console.log(`Mermaid graph written to ${options.output}`);
        console.log(`You can generate a visual graph using: mmdc -i ${options.output} -o graph.png`);

      } catch (error) {
        console.error('Error generating vouch graph:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}