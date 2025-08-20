import { Command } from 'commander';
import { LibraClient, Network, LibraViews, MoveValue } from 'open-libra-sdk';
import { validateAndNormalizeAddress } from '../utils/address';

export function registerVouchesCommand(program: Command) {
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
}