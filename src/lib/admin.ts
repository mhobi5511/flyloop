const adminEmail = "marc.hobi@gmx.ch";

export type AdminUserLike = {
  email?: string | null;
} | null;

export function isAdmin(user: AdminUserLike) {
  return user?.email?.toLowerCase() === adminEmail;
}

export { adminEmail };
