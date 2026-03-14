/**
 * Per-file debounce: maintains a separate timer for each file path so that
 * rapid successive events on the same file only trigger the callback once,
 * while events on different files are handled independently.
 */
export function debounceFile<T extends (filePath: string) => void | Promise<void>>(
  fn: T,
  delayMs: number,
): (filePath: string) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (filePath: string) => {
    const existing = timers.get(filePath);
    if (existing) clearTimeout(existing);

    timers.set(
      filePath,
      setTimeout(() => {
        timers.delete(filePath);
        fn(filePath);
      }, delayMs),
    );
  };
}
