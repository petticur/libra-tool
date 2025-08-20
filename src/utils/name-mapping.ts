import { readFileSync } from 'fs';

/**
 * Default URL for validator handle mappings
 */
export const DEFAULT_NAME_MAPPING_URL = 'https://raw.githubusercontent.com/0LNetworkCommunity/v7-addresses/refs/heads/main/validator-handle.json';

/**
 * Interface for name mapping JSON structure
 */
export interface NameMappingData {
  validators?: Record<string, string>;
  [key: string]: any;
}

/**
 * Map to store address to name mappings
 */
export type AddressNameMap = Map<string, string>;

/**
 * Loads name mappings from a local JSON file
 */
export function loadNameMappingFromFile(filepath: string): AddressNameMap {
  const nameMap = new Map<string, string>();
  try {
    const content = readFileSync(filepath, 'utf-8');
    const data: NameMappingData = JSON.parse(content);

    // Process validators field if it exists
    if (data.validators && typeof data.validators === 'object') {
      for (const [address, name] of Object.entries(data.validators)) {
        if (typeof name === 'string') {
          // Normalize the address (ensure 0x prefix and lowercase)
          const normalizedAddr = address.startsWith('0x') ? address.toLowerCase() : '0x' + address.toLowerCase();
          nameMap.set(normalizedAddr, name);
        }
      }
    }

    console.log(`Loaded ${nameMap.size} name mappings from ${filepath}`);
  } catch (error) {
    console.warn(`Failed to load name mappings from ${filepath}:`, error instanceof Error ? error.message : error);
  }
  return nameMap;
}

/**
 * Loads name mappings from a URL
 */
export async function loadNameMappingFromURL(url: string): Promise<AddressNameMap> {
  const nameMap = new Map<string, string>();
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as NameMappingData;

    // Process validators field if it exists
    if (data.validators && typeof data.validators === 'object') {
      for (const [address, name] of Object.entries(data.validators)) {
        if (typeof name === 'string') {
          // Normalize the address (ensure 0x prefix and lowercase)
          const normalizedAddr = address.startsWith('0x') ? address.toLowerCase() : '0x' + address.toLowerCase();
          nameMap.set(normalizedAddr, name);
        }
      }
    }

    console.log(`Loaded ${nameMap.size} name mappings from ${url}`);
  } catch (error) {
    console.warn(`Failed to load name mappings from ${url}:`, error instanceof Error ? error.message : error);
  }
  return nameMap;
}

/**
 * Loads name mappings from multiple sources (files and URLs)
 * Later sources override earlier ones for the same address
 */
export async function loadAllNameMappings(sources: string[], useDefault: boolean = true): Promise<AddressNameMap> {
  const mergedMap = new Map<string, string>();

  // Load default mapping first if enabled
  if (useDefault) {
    const defaultMap = await loadNameMappingFromURL(DEFAULT_NAME_MAPPING_URL);
    for (const [addr, name] of defaultMap) {
      mergedMap.set(addr, name);
    }
  }

  // Load custom mappings (these override defaults)
  for (const source of sources) {
    let sourceMap: AddressNameMap;

    // Determine if source is URL or file
    if (source.startsWith('http://') || source.startsWith('https://')) {
      sourceMap = await loadNameMappingFromURL(source);
    } else {
      sourceMap = loadNameMappingFromFile(source);
    }

    // Merge into main map (overriding existing entries)
    for (const [addr, name] of sourceMap) {
      mergedMap.set(addr, name);
    }
  }

  console.log(`Total name mappings loaded: ${mergedMap.size}`);
  return mergedMap;
}