import { LibraClient, LibraViews } from 'open-libra-sdk';
import { shortenAddress } from './address';
import { VouchEdge } from './graph';

/**
 * Fetches the set of root addresses from the trust registry
 */
export async function fetchRootAddresses(client: LibraClient): Promise<string[]> {
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
 * Recursively fetches vouches to build a graph
 */
export async function fetchVouchGraph(
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