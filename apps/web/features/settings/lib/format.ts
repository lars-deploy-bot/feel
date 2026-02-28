/** Returns "s" if count !== 1, "" otherwise. Usage: `${count} item${plural(count)}` */
export function plural(count: number): string {
  return count !== 1 ? "s" : ""
}
