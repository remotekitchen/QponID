/**
 * Build E.164 for Bangladesh (+880) from user input.
 * Accepts: 01XXXXXXXXX, 8801XXXXXXXXX, 1712345678, +880…
 * Mobile NSN is 10 digits starting with 1 (after dropping trunk 0).
 */
export function toBangladeshE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let n = digits;

  if (n.startsWith('880')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);

  if (n.length !== 10 || !n.startsWith('1')) return null;

  return `+880${n}`;
}

export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length < 4) return e164;
  const tail = d.slice(-4);
  return `••••${tail}`;
}
