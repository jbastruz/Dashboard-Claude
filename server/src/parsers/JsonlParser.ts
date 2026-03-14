import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

/**
 * Incremental JSONL parser that tracks byte offsets per file so it can
 * resume reading only the new lines appended since the last parse.
 */
export class JsonlParser {
  /** filePath → byte offset already consumed */
  private offsets = new Map<string, number>();

  /**
   * Read new lines from `filePath` starting after the last known offset.
   * Returns the newly parsed JSON objects (one per line).
   */
  async parse(filePath: string): Promise<unknown[]> {
    const results: unknown[] = [];
    let currentOffset = this.offsets.get(filePath) ?? 0;

    try {
      const stat = await fs.stat(filePath);

      // Nothing new to read
      if (stat.size <= currentOffset) {
        return results;
      }

      const stream = createReadStream(filePath, {
        start: currentOffset,
        encoding: "utf-8",
      });

      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          results.push(JSON.parse(trimmed));
        } catch {
          // Skip malformed lines
          console.log(`[dashboard] jsonl: skipping malformed line in ${filePath}`);
        }
      }

      // Use stat.size as the new offset — reliable regardless of line
      // endings (\n vs \r\n) since we consumed everything from currentOffset
      // to EOF via the readline stream.
      this.offsets.set(filePath, stat.size);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[dashboard] jsonl: error reading ${filePath}: ${message}`);
    }

    return results;
  }

  /**
   * Reset the stored offset for a file (e.g. when the file is removed).
   */
  reset(filePath: string): void {
    this.offsets.delete(filePath);
  }

  /**
   * Reset all stored offsets.
   */
  resetAll(): void {
    this.offsets.clear();
  }
}
