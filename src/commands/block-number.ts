import { Command } from 'commander';
import { LibraClient, Network } from 'open-libra-sdk';

export function registerBlockNumberCommand(program: Command) {
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
}