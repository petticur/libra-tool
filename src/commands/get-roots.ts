import { Command } from 'commander';
import { LibraClient, Network } from 'open-libra-sdk';
import { fetchRootAddresses } from '../utils/vouching';

export function registerGetRootsCommand(program: Command) {
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
            console.log(`  ${addr}`);
          });
        }
      } catch (error) {
        console.error('Error fetching root addresses:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}