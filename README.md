# libra-tool

TypeScript CLI tool for Libra blockchain operations.

## Installation

```bash
npm install
npm run build
```

## Usage

The tool supports both mainnet and testnet operations. Use the `--testnet` flag at the global level to switch to testnet.

### Commands

#### version
Display the tool version number.

```bash
libra-tool version
```

#### block-number
Get the current block number from the Libra blockchain.

```bash
# Mainnet
libra-tool block-number

# Testnet
libra-tool --testnet block-number
```

#### vouches
Get received vouches for an account address. Accepts addresses with or without "0x" prefix.

```bash
# Mainnet
libra-tool vouches 0x1234567890abcdef...

# Testnet
libra-tool --testnet vouches 1234567890abcdef...

# 32-character addresses are automatically extended to 64 characters
libra-tool vouches 1234567890abcdef1234567890abcdef
```

#### get-roots
Get the current set of root addresses from the trust registry.

```bash
# Mainnet
libra-tool get-roots

# Testnet
libra-tool --testnet get-roots
```

#### vouch-graph
Generate a [Mermaid](https://mermaid.js.org/) graph visualization of the vouching network for an address. This command recursively fetches vouches to build a graph of the vouching relationships, calculates trust scores, and can display human-readable names for addresses.

```bash
# Generate graph with default settings
libra-tool vouch-graph 0x1234567890abcdef...

# Specify custom vouch and score depths
libra-tool vouch-graph 0x1234... --vouch-depth 5 --score-depth 3

# Use custom name mappings
libra-tool vouch-graph 0x1234... --name-mappings custom-names.json https://example.com/names.json

# Disable default name mappings
libra-tool vouch-graph 0x1234... --no-default-names

# Use testnet with custom output
libra-tool --testnet vouch-graph 0x1234... --output my-graph.md
```

**Options:**
- `--vouch-depth <number>` - Maximum depth to traverse for fetching vouches (default: 3). Higher values fetch more relationships but take longer.
- `--score-depth <number>` - Maximum depth to traverse for calculating trust scores (default: 0 for unlimited). Controls how far from root addresses scores propagate.
- `-o, --output <file>` - Output file path for the Mermaid markdown (default: vouch-graph.md)
- `--name-mappings <sources...>` - JSON files or URLs containing address-to-name mappings. Can specify multiple sources.
- `--no-default-names` - Disable loading default validator name mappings from GitHub

**Features:**
- Automatically handles cycles in the vouching graph
- Validates and normalizes addresses (32-char addresses are extended to 64)
- Calculates trust scores based on distance from root addresses (200K base score, halved at each hop)
- Displays human-readable names for known addresses (loaded from JSON mappings)
- Shows shortened addresses (0x1234...5678) and scores in the graph nodes
- Different node colors: pink for start address, green for root addresses
- Generates Mermaid-compatible markdown for visualization

**Converting to Image:**
After generating the Mermaid markdown file, you can convert it to an image using [mermaid-cli](https://github.com/mermaid-js/mermaid-cli):

```bash
# Install mermaid-cli if not already installed
npm install -g @mermaid-js/mermaid-cli

# Convert to PNG
mmdc -i vouch-graph.md -o graph.png

# Convert to SVG
mmdc -i vouch-graph.md -o graph.svg
```

## Address Format

All commands that accept addresses support the following formats:
- With "0x" prefix: `0x1234567890abcdef...`
- Without prefix: `1234567890abcdef...`
- 32-character addresses (automatically extended to 64 by prepending zeros)
- 64-character addresses (used as-is)

Addresses must contain only hexadecimal characters (0-9, A-F, case-insensitive).

## Development

```bash
# Run in development mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Clean build artifacts
npm run clean
```