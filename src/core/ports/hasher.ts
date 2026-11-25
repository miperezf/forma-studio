/** Hash SHA-256 en hexadecimal sobre un texto canónico. La implementación vive en infraestructura. */
export interface Hasher {
  sha256Hex(canonicalText: string): Promise<string>
}
