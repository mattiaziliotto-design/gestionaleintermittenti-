// Avvia il download di un contenuto generato nel browser
export function downloadBlob(content: Blob | Uint8Array | string, fileName: string, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Rilascio differito: alcuni browser avviano il download in modo asincrono
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rende un testo utilizzabile come parte di un nome file
export const safeFileName = (text: string): string => text.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
