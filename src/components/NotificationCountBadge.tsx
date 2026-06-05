type NotificationCountBadgeProps = {
  count: number;
  className?: string;
};

export function NotificationCountBadge({
  count,
  className = "",
}: NotificationCountBadgeProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
      className={`absolute -right-2 -top-2 z-10 grid min-w-5 place-items-center rounded-full bg-sky-600 px-1.5 text-xs font-black leading-5 text-white shadow-sm ring-2 ring-white ${className}`}
    >
      {count}
    </span>
  );
}
