#!/usr/bin/env node

import { Command } from 'commander';
import { version } from '../package.json';
import { registerBlockNumberCommand } from './commands/block-number';
import { registerVouchesCommand } from './commands/vouches';
import { registerVouchGraphCommand } from './commands/vouch-graph';
import { registerGetRootsCommand } from './commands/get-roots';

const program = new Command();

program
  .name('libra-tool')
  .description('TypeScript CLI tool for Libra')
  .version(version, '-v, --version', 'display version number')
  .option('--testnet', 'Use testnet instead of mainnet')
  .option('--url <url>', 'Custom RPC endpoint URL');

// Register version command (simple inline command)
program
  .command('version')
  .description('Print version number')
  .action(() => {
    console.log(version);
  });

// Register commands from separate modules
registerBlockNumberCommand(program);
registerVouchesCommand(program);
registerVouchGraphCommand(program);
registerGetRootsCommand(program);

program.parse(process.argv);