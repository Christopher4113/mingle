export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  // Easiest cross-browser conversion
  const res = await fetch(dataUrl)
  return await res.blob()
}