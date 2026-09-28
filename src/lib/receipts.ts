import { createClient } from "@/lib/supabase/client";

const BUCKET = "receipts";
const MAX_SIDE = 1600;

/** Shrinks a photo to at most 1600px and re-encodes as JPEG (a 4MB camera shot → ~200KB). */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.8),
  );
}

/** Uploads to "<user id>/<expense id>-<time>.jpg" (the folder is what the storage policy checks). */
export async function uploadReceipt(userId: string, expenseId: string, file: File): Promise<string> {
  const path = `${userId}/${expenseId}-${Date.now()}.jpg`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, await compressImage(file), { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await createClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function deleteReceipt(path: string) {
  await createClient().storage.from(BUCKET).remove([path]);
}

/** Removes every receipt photo of a user (account deletion: storage isn't covered by DB cascades). */
export async function deleteAllReceipts(userId: string) {
  const bucket = createClient().storage.from(BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: removeError } = await bucket.remove(data.map((file) => `${userId}/${file.name}`));
    if (removeError) throw removeError;
  }
}
