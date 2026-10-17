/** Splits "Время *расцвета* и сияния" into plain and accent parts for rendering. */
export function splitAccent(title: string): { text: string; accent: boolean }[] {
  return title
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('*') && part.endsWith('*')
        ? { text: part.slice(1, -1), accent: true }
        : { text: part, accent: false },
    );
}
