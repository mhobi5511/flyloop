"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AdminTunnelHeaderImageFormProps = {
  tunnel: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    header_image_url: string | null;
  };
};

export function AdminTunnelHeaderImageForm({
  tunnel,
}: AdminTunnelHeaderImageFormProps) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(tunnel.header_image_url ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function uploadHeader(file: File | undefined) {
    if (!file) {
      return;
    }

    setMessage("");
    setError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Tunnel header image must be smaller than 5 MB.");
      return;
    }

    setIsUploading(true);
    const supabase = createSupabaseBrowserClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${tunnel.id}/header.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("tunnel-images")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Tunnel image upload failed", uploadError);
      setIsUploading(false);
      setError("Could not upload tunnel image. Please try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("tunnel-images")
      .getPublicUrl(path);
    const nextUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const { error: saveError } = await supabase
      .from("tunnel_profiles")
      .update({ header_image_url: nextUrl })
      .eq("id", tunnel.id);

    setIsUploading(false);

    if (saveError) {
      console.error("Tunnel image URL save failed", saveError);
      setError("Image uploaded, but Flyloop could not save it to the tunnel.");
      return;
    }

    setImageUrl(nextUrl);
    setMessage("Header image updated.");
    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-20 w-28 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="h-20 w-28 shrink-0 rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-black text-slate-950">
            {tunnel.name}
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {formatLocation(tunnel.city, tunnel.country)}
          </p>
          <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white">
            {isUploading ? "Uploading..." : imageUrl ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploading}
              className="sr-only"
              onChange={(event) => void uploadHeader(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>
      {message ? (
        <p className="mt-3 rounded-xl bg-sky-50 p-2 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}
