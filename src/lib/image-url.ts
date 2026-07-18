export function isOptimizableSupabaseImage(imageUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return false;
  }

  try {
    const image = new URL(imageUrl);
    const storage = new URL(supabaseUrl);
    return (
      image.protocol === "https:" &&
      storage.protocol === "https:" &&
      image.origin === storage.origin &&
      image.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
