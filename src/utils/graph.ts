import { shortenAddress } from './address';
import { AddressNameMap } from './name-mapping';

/**
 * Edge in the vouch graph
 */
export interface VouchEdge {
  from: string;
  to: string;
}

/**
 * Map to store final accumulated scores for addresses
 */
export type ScoreMap = Map<string, number>;

/**
 * Formats a score for display (e.g., 500000 -> "500K")
 */
export function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${Math.floor(score / 1000000)}M`;
  } else if (score >= 1000) {
    return `${Math.floor(score / 1000)}K`;
  } else {
    return score.toString();
  }
}

/**
 * Generates Mermaid graph markdown from edges
 * @param nameMap - Optional map of addresses to names for display
 */
export function generateMermaidGraph(
  edges: VouchEdge[],
  startAddress: string,
  rootAddresses: Set<string>,
  scores: ScoreMap,
  nameMap?: AddressNameMap
): string {
  if (edges.length === 0) {
    // Check if start address is a root
    const isRoot = rootAddresses.has(startAddress);

    // If no edges, just show the single node with special styling
    const score = scores.get(startAddress) || 0;
    const scoreText = score > 0 ? ` (${formatScore(score)})` : '';
    const name = nameMap?.get(startAddress.toLowerCase());
    const nameText = name ? `<br/>${name}` : '';
    return `\`\`\`mermaid
graph TD
    ${startAddress}["${shortenAddress(startAddress)}${scoreText}${nameText}"]
    style ${startAddress} fill:${isRoot ? '#9f9' : '#f9f'},stroke:#333,stroke-width:4px
\`\`\`\n`;
  }

  // Collect all unique addresses
  const addresses = new Set<string>();
  addresses.add(startAddress);
  edges.forEach(edge => {
    addresses.add(edge.from);
    addresses.add(edge.to);
  });

  // Build the Mermaid graph
  let mermaid = '```mermaid\ngraph TD\n';

  // Add node definitions with shortened labels, scores, and names
  addresses.forEach(addr => {
    const score = scores.get(addr) || 0;
    const scoreText = score > 0 ? ` (${formatScore(score)})` : '';
    const name = nameMap?.get(addr.toLowerCase());
    const nameText = name ? `<br/>${name}` : '';
    mermaid += `    ${addr}["${shortenAddress(addr)}${scoreText}${nameText}"]\n`;
  });

  // Style the start node differently (pink)
  mermaid += `    style ${startAddress} fill:#f9f,stroke:#333,stroke-width:4px\n`;

  // Style root nodes differently (green)
  addresses.forEach(addr => {
    if (rootAddresses.has(addr) && addr !== startAddress) {
      mermaid += `    style ${addr} fill:#9f9,stroke:#333,stroke-width:2px\n`;
    }
  });

  // Add edges
  edges.forEach(edge => {
    mermaid += `    ${edge.from} --> ${edge.to}\n`;
  });

  mermaid += '```\n';

  return mermaid;
}