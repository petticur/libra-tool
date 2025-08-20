import { LibraClient, LibraViews } from 'open-libra-sdk';
import { shortenAddress } from './address';
import { ScoreMap } from './graph';

/**
 * Calculates trust scores for all addresses by walking BACKWARD from each address to roots
 * This matches the behavior of walking from target to roots via received vouches
 * Root addresses start with score 200,000, halved at each hop from the root
 * @param depth - Maximum depth to traverse from addresses to roots (0 = unlimited)
 */
export async function calculateAddressScores(
  client: LibraClient,
  rootAddresses: Set<string>,
  allAddresses: Set<string>,
  depth: number = 0
): Promise<ScoreMap> {
  const scores = new Map<string, number>();
  const ROOT_SCORE = 200000;

  // Initialize all addresses with score 0
  allAddresses.forEach(addr => scores.set(addr, 0));

  // Set fixed scores for root addresses
  rootAddresses.forEach(rootAddr => {
    if (allAddresses.has(rootAddr)) {
      scores.set(rootAddr, ROOT_SCORE);
    }
  });

  // Calculate score for each non-root address by walking backward to roots
  for (const targetAddr of allAddresses) {
    // Skip root addresses (they already have fixed scores)
    if (rootAddresses.has(targetAddr)) continue;

    console.log(`Calculating score for: ${shortenAddress(targetAddr)}`);

    // BFS backward from target to find all paths to roots
    const queue: Array<{address: string, depth: number, path: Set<string>}> = [
      {address: targetAddr, depth: 0, path: new Set([targetAddr])}
    ];

    while (queue.length > 0) {
      const {address, depth: currentDepth, path} = queue.shift()!;

      // Skip if we've reached max depth (if depth is specified and greater than 0)
      if (depth > 0 && currentDepth >= depth) continue;

      // Check if we've reached a root
      if (rootAddresses.has(address)) {
        // Calculate score contribution from this path
        const pathScore = Math.floor(ROOT_SCORE / Math.pow(2, currentDepth));
        const currentScore = scores.get(targetAddr) || 0;
        scores.set(targetAddr, currentScore + pathScore);
        console.log(`Found path to root ${shortenAddress(address)} at depth ${currentDepth}, contributing ${pathScore} to ${shortenAddress(targetAddr)}`)
        continue; // Don't traverse beyond roots
      }

      try {
        // Fetch who vouches FOR this address (backward direction - received vouches)
        const payload = LibraViews.vouch_getReceivedVouches(address);
        const result = await client.viewJson(payload);

        if (Array.isArray(result) && result.length === 2) {
          const [addresses] = result;
          if (Array.isArray(addresses)) {
            // Process each address that vouches FOR the current address
            for (const voucherAddr of addresses) {
              const voucherAddress = String(voucherAddr);

              // Only process if this address is in our graph and not in current path (avoid cycles)
              if (allAddresses.has(voucherAddress) && !path.has(voucherAddress)) {
                // Add to queue for further traversal (creating new path set to track cycles)
                const newPath = new Set(path);
                newPath.add(voucherAddress);
                queue.push({
                  address: voucherAddress,
                  depth: currentDepth + 1,
                  path: newPath
                });
              }
            }
          }
        }
      } catch (error) {
        // Skip addresses that can't be fetched
        console.warn(`Could not fetch received vouches for ${shortenAddress(address)} during scoring`,
          error instanceof Error ? error.message : error);
      }
    }
  }

  return scores;
}