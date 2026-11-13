const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function valorePari(c: string): number {
  return c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 65;
}

// Verifica formato e carattere di controllo di un codice fiscale di persona fisica
// (16 caratteri, omocodie incluse) oppure numerico provvisorio (11 cifre).
export function isCodiceFiscaleValido(value: string): boolean {
  const cf = value.toUpperCase().trim();

  if (/^\d{11}$/.test(cf)) {
    let somma = 0;
    for (let i = 0; i < 10; i++) {
      const n = Number(cf[i]);
      if (i % 2 === 0) somma += n;
      else somma += n * 2 > 9 ? n * 2 - 9 : n * 2;
    }
    return (10 - (somma % 10)) % 10 === Number(cf[10]);
  }

  if (!/^[A-Z0-9]{15}[A-Z]$/.test(cf)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    // Le posizioni sono contate da 1: la prima è dispari
    somma += i % 2 === 0 ? DISPARI[cf[i]] : valorePari(cf[i]);
  }
  return String.fromCharCode(65 + (somma % 26)) === cf[15];
}
