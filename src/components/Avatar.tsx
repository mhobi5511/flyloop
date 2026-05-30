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

export function Avatar({ name, imageUrl, size = "md" }: AvatarProps) {
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ? `${name} profile photo` : "Profile photo"}
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
