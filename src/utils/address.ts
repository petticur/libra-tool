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
export function validateAndNormalizeAddress(address: string): string {
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

  // Normalize address: convert to lower case and ensure 0x prefix
  return '0x' + addressWithoutPrefix.toLowerCase();
}

/**
 * Shortens an address for display in the graph
 * Shows "0x" prefix plus first 4 and last 4 characters of the actual address
 */
export function shortenAddress(address: string): string {
  // Remove 0x prefix if present for consistent handling
  const cleanAddress = address.replace(/^0x/i, '');
  if (cleanAddress.length <= 8) return '0x' + cleanAddress;
  return `0x${cleanAddress.slice(0, 4)}...${cleanAddress.slice(-4)}`;
}