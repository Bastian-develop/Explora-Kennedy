import { isSupabaseConfigured, supabase } from './supabaseClient';

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
  reader.readAsDataURL(file);
});

export const uploadPlaceImage = async (file: File, placeId: string): Promise<string> => {
  if (!isSupabaseConfigured) return readAsDataUrl(file);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usa una imagen JPG, PNG o WEBP.');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 10 MB.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${placeId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('place-media').upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;

  return supabase.storage.from('place-media').getPublicUrl(path).data.publicUrl;
};
