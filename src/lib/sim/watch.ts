/**
 * Lets a simulation take values from the student's program only when the program actually sets a new one,
 * so manual sliders keep working until the program writes to the same output again.
 */
export class ValueWatcher {
  private source: object | null = null;
  private last = new Map<string, number>();

  poll(source: object, key: string, value: number | undefined, apply: (v: number) => void) {
    if (this.source !== source) {
      this.source = source;
      this.last.clear();
    }
    if (value === undefined || this.last.get(key) === value) return;
    this.last.set(key, value);
    apply(value);
  }
}
