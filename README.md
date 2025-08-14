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

#### vouch-graph
Generate a [Mermaid](https://mermaid.js.org/) graph visualization of the vouching network for an address. This command recursively fetches vouches to build a graph of the vouching relationships.

```bash
# Generate graph with default depth (3) and output file (vouch-graph.md)
libra-tool vouch-graph 0x1234567890abcdef...

# Specify custom depth and output file
libra-tool vouch-graph 0x1234... --depth 5 --output my-graph.md

# Use testnet
libra-tool --testnet vouch-graph 0x1234...
```

**Options:**
- `-d, --depth <number>` - Maximum depth to traverse the graph (default: 3). Higher values fetch more relationships but take longer.
- `-o, --output <file>` - Output file path for the Mermaid markdown (default: vouch-graph.md)

**Features:**
- Automatically handles cycles in the vouching graph
- Validates and normalizes addresses (32-char addresses are extended to 64)
- Generates Mermaid-compatible markdown for visualization
- Shows shortened addresses in the graph for readability

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