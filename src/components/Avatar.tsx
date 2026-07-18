import Image from "next/image";
import { isOptimizableSupabaseImage } from "@/lib/image-url";

type AvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "size-9 text-xs rounded-xl",
  md: "size-12 text-sm rounded-2xl",
  lg: "size-20 text-xl rounded-2xl",
};

const pixelSizes = {
  sm: 36,
  md: 48,
  lg: 80,
};

export function Avatar({ name, imageUrl, size = "md" }: AvatarProps) {
  const initials = getInitials(name);

  if (imageUrl) {
    const dimension = pixelSizes[size];

    if (isOptimizableSupabaseImage(imageUrl)) {
      return (
        <Image
          src={imageUrl}
          alt={name ? `${name} profile photo` : "Profile photo"}
          width={dimension}
          height={dimension}
          sizes={`${dimension}px`}
          className={`${sizes[size]} shrink-0 object-cover`}
        />
      );
    }

    return (
      // External profile URLs remain supported when they are outside Flyloop storage.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ? `${name} profile photo` : "Profile photo"}
        width={dimension}
        height={dimension}
        loading="lazy"
        decoding="async"
        className={`${sizes[size]} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} grid shrink-0 place-items-center bg-sky-50 font-black text-sky-700`}
    >
      {initials}
    </div>
  );
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) {
    return "F";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
