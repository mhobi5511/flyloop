"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MapPin, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminTunnel = {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string | null;
  website: string | null;
  description: string | null;
  wind_quality_notes: string | null;
  size: string | null;
  region: string | null;
  header_image_url: string | null;
};

export type AdminUserOverview = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_organizer: boolean | null;
  wants_to_create_opportunities: boolean | null;
};

export type AdminStats = {
  totalUsers: number;
  coaches: number;
  athletesOnly: number;
  campsCreated: number;
  huckJamsCreated: number;
};

type TunnelDraft = Omit<AdminTunnel, "id">;

type GeocodeSummary = {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  failed_items: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
};

const emptyTunnel: TunnelDraft = {
  name: "",
  country: "",
  city: "",
  address: "",
  website: "",
  description: "",
  wind_quality_notes: "",
  size: "",
  region: "",
  header_image_url: "",
};

export function AdminDashboard({
  initialTunnels,
  initialMissingCoordinateCount,
  stats,
  users,
}: {
  initialTunnels: AdminTunnel[];
  initialMissingCoordinateCount: number;
  stats: AdminStats;
  users: AdminUserOverview[];
}) {
  const [tunnels, setTunnels] = useState(initialTunnels);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<TunnelDraft>(emptyTunnel);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTunnelId, setEditingTunnelId] = useState<string | null>(null);
  const [deleteTunnel, setDeleteTunnel] = useState<AdminTunnel | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [uploadingTunnelId, setUploadingTunnelId] = useState<string | null>(null);
  const [missingCoordinateCount, setMissingCoordinateCount] = useState(
    initialMissingCoordinateCount,
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState("");
  const [geocodeResult, setGeocodeResult] = useState<GeocodeSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasTunnelQuery = query.trim().length > 0;

  const filteredTunnels = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return tunnels.filter((tunnel) =>
      [
        tunnel.name,
        tunnel.city,
        tunnel.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, tunnels]);

  function openCreate() {
    setEditingTunnelId(null);
    setDraft(emptyTunnel);
    setIsEditorOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(tunnel: AdminTunnel) {
    setEditingTunnelId(tunnel.id);
    setDraft({
      name: tunnel.name,
      country: tunnel.country,
      city: tunnel.city,
      address: tunnel.address ?? "",
      website: tunnel.website ?? "",
      description: tunnel.description ?? "",
      wind_quality_notes: tunnel.wind_quality_notes ?? "",
      size: tunnel.size ?? "",
      region: tunnel.region ?? "",
      header_image_url: tunnel.header_image_url ?? "",
    });
    setMessage("");
    setError("");
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setEditingTunnelId(null);
    setDraft(emptyTunnel);
    setIsEditorOpen(false);
  }

  async function saveTunnel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (
      !draft.name.trim() ||
      !draft.country.trim() ||
      !draft.city.trim() ||
      !draft.region?.trim()
    ) {
      setError("Name, country, city and region are required.");
      return;
    }

    setIsSaving(true);
    const supabase = createSupabaseBrowserClient();
    const payload = cleanTunnelDraft(draft);
    const result = editingTunnelId
      ? await supabase
          .from("tunnel_profiles")
          .update(payload)
          .eq("id", editingTunnelId)
          .select("*")
          .single()
      : await supabase
          .from("tunnel_profiles")
          .insert(payload)
          .select("*")
          .single();

    setIsSaving(false);

    if (result.error) {
      console.error("Tunnel save failed", result.error);
      setError("Could not save tunnel. Check admin access and try again.");
      return;
    }

    const saved = result.data as AdminTunnel;
    const previousTunnel = editingTunnelId
      ? tunnels.find((tunnel) => tunnel.id === editingTunnelId)
      : null;
    setTunnels((current) =>
      editingTunnelId
        ? current.map((tunnel) => (tunnel.id === saved.id ? saved : tunnel))
        : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
    );
    closeEditor();
    setMessage(editingTunnelId ? "Tunnel updated." : "Tunnel created.");

    if (
      !previousTunnel ||
      previousTunnel.city !== saved.city ||
      previousTunnel.country !== saved.country
    ) {
      void runGeocode("missing");
    }
  }

  async function confirmDeleteTunnel() {
    if (!deleteTunnel || deleteConfirmation !== deleteTunnel.name) {
      setError("Type the tunnel name exactly to confirm deletion.");
      return;
    }

    setMessage("");
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: deleteError } = await supabase
      .from("tunnel_profiles")
      .delete()
      .eq("id", deleteTunnel.id);

    if (deleteError) {
      console.error("Tunnel delete failed", deleteError);
      setError("Could not delete tunnel. It may still be used by opportunities.");
      return;
    }

    setTunnels((current) =>
      current.filter((tunnel) => tunnel.id !== deleteTunnel.id),
    );
    setDeleteTunnel(null);
    setDeleteConfirmation("");
    setMessage("Tunnel deleted.");
  }

  async function uploadHeader(tunnel: AdminTunnel, file: File | undefined) {
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

    setUploadingTunnelId(tunnel.id);
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
      setUploadingTunnelId(null);
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

    setUploadingTunnelId(null);

    if (saveError) {
      console.error("Tunnel image save failed", saveError);
      setError("Image uploaded, but the tunnel URL could not be saved.");
      return;
    }

    setTunnels((current) =>
      current.map((item) =>
        item.id === tunnel.id ? { ...item, header_image_url: nextUrl } : item,
      ),
    );
    setMessage("Tunnel image updated.");
  }

  async function runGeocode(mode: "missing" | "all") {
    if (mode === "all") {
      const confirmed = window.confirm(
        "Re-geocode all tunnels? Existing coordinates will be overwritten.",
      );

      if (!confirmed) {
        return;
      }
    }

    setIsGeocoding(true);
    setGeocodeResult(null);
    setGeocodeStatus(
      mode === "all"
        ? "Re-geocoding all tunnels..."
        : `0 of ${missingCoordinateCount} tunnels geocoded`,
    );
    setError("");

    const response = await fetch("/api/admin/geocode-tunnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });

    setIsGeocoding(false);

    if (!response.ok) {
      setError("Could not run tunnel geocoding.");
      setGeocodeStatus("");
      return;
    }

    const summary = (await response.json()) as GeocodeSummary;
    setGeocodeResult(summary);
    setMissingCoordinateCount((current) =>
      mode === "all" ? summary.failed : Math.max(current - summary.updated, 0),
    );
    setGeocodeStatus(`${summary.updated} of ${summary.total} tunnels geocoded`);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">
              Tunnel Management
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Search by tunnel name, city or country.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isGeocoding}
              onClick={() => void runGeocode("missing")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 disabled:text-slate-400"
            >
              <MapPin size={16} />
              Backfill missing tunnel coordinates
            </button>
            <button
              type="button"
              disabled={isGeocoding}
              onClick={() => void runGeocode("all")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 px-3 text-sm font-bold text-amber-700 disabled:text-slate-400"
            >
              Re-geocode all tunnels
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white"
            >
              <Plus size={16} />
              New Tunnel
            </button>
          </div>
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tunnel, city or country"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          <p>{missingCoordinateCount} tunnels still miss coordinates.</p>
          {isGeocoding || geocodeStatus ? (
            <p className="mt-1 text-sky-700">
              {isGeocoding ? geocodeStatus || "Geocoding tunnels..." : geocodeStatus}
            </p>
          ) : null}
          {geocodeResult ? (
            <div className="mt-2 grid gap-1">
              <p>
                Updated {geocodeResult.updated}, failed {geocodeResult.failed},
                skipped {geocodeResult.skipped}.
              </p>
              {geocodeResult.failed_items.length > 0 ? (
                <div className="grid gap-1">
                  {geocodeResult.failed_items.map((item) => (
                    <p key={item.id} className="text-rose-700">
                      {item.name}: {item.reason}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {message ? (
          <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        {hasTunnelQuery ? (
          <>
            <p className="mt-3 text-sm font-bold text-slate-500">
              {filteredTunnels.length} matching tunnels
            </p>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Tunnel</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Region</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3">Header</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTunnels.map((tunnel) => (
                    <TunnelTableRow
                      key={tunnel.id}
                      tunnel={tunnel}
                      uploading={uploadingTunnelId === tunnel.id}
                      onEdit={openEdit}
                      onDelete={setDeleteTunnel}
                      onUpload={uploadHeader}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-3 md:hidden">
              {filteredTunnels.map((tunnel) => (
                <TunnelCard
                  key={tunnel.id}
                  tunnel={tunnel}
                  uploading={uploadingTunnelId === tunnel.id}
                  onEdit={openEdit}
                  onDelete={setDeleteTunnel}
                  onUpload={uploadHeader}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Enter a search term to find and edit tunnels.
          </p>
        )}

        {hasTunnelQuery && filteredTunnels.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            No tunnels match your search.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h2 className="text-xl font-black tracking-tight">User Overview</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard label="Coaches" value={stats.coaches} />
          <StatCard label="Athletes only" value={stats.athletesOnly} />
          <StatCard label="Camps created" value={stats.campsCreated} />
          <StatCard label="Huck Jams created" value={stats.huckJamsCreated} />
        </div>
        <div className="mt-3 grid gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="grid gap-1 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_1.4fr_140px] sm:items-center"
            >
              <p className="font-bold text-slate-950">
                {user.full_name ?? "Unnamed user"}
              </p>
              <p className="text-sm font-semibold text-slate-500">
                {user.email ?? "No email"}
              </p>
              <p className="text-sm font-bold text-sky-700">
                {formatRole(user)}
              </p>
            </div>
          ))}
          {users.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              No users found.
            </p>
          ) : null}
        </div>
      </section>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4">
          <form
            onSubmit={saveTunnel}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-tight">
                {editingTunnelId ? "Edit tunnel" : "New tunnel"}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <TunnelFormFields draft={draft} setDraft={setDraft} />
            <button
              type="submit"
              disabled={isSaving}
              className="mt-4 h-11 w-full rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
            >
              {isSaving ? "Saving..." : "Save tunnel"}
            </button>
          </form>
        </div>
      ) : null}

      {deleteTunnel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-xl font-black tracking-tight">Delete tunnel?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Are you sure? Type the tunnel name to confirm.
            </p>
            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-black text-slate-900">
              {deleteTunnel.name}
            </p>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="field mt-3"
              placeholder={deleteTunnel.name}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTunnel(null);
                  setDeleteConfirmation("");
                }}
                className="h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTunnel()}
                className="h-10 rounded-xl bg-rose-600 text-sm font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function TunnelTableRow({
  tunnel,
  uploading,
  onEdit,
  onDelete,
  onUpload,
}: {
  tunnel: AdminTunnel;
  uploading: boolean;
  onEdit: (tunnel: AdminTunnel) => void;
  onDelete: (tunnel: AdminTunnel) => void;
  onUpload: (tunnel: AdminTunnel, file: File | undefined) => void;
}) {
  return (
    <tr>
      <td className="py-3 pr-3">
        <p className="font-black text-slate-950">{tunnel.name}</p>
        <p className="line-clamp-1 text-xs font-semibold text-slate-500">
          {tunnel.website ?? "No website"}
        </p>
      </td>
      <td className="py-3 pr-3 text-sm font-semibold text-slate-600">
        {tunnel.city}, {tunnel.country}
      </td>
      <td className="py-3 pr-3 text-sm font-semibold text-slate-600">
        {tunnel.region ?? "-"}
      </td>
      <td className="py-3 pr-3 text-sm font-semibold text-slate-600">
        {tunnel.size ?? "-"}
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          {tunnel.header_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tunnel.header_image_url}
              alt=""
              className="size-10 rounded-lg object-cover"
            />
          ) : (
            <div className="size-10 rounded-lg bg-gradient-to-br from-sky-100 to-cyan-50" />
          )}
          <ImageUploader tunnel={tunnel} uploading={uploading} onUpload={onUpload} />
        </div>
      </td>
      <td className="py-3">
        <div className="flex justify-end gap-1">
          <IconButton label="Edit tunnel" onClick={() => onEdit(tunnel)}>
            <Pencil size={15} />
          </IconButton>
          <IconButton label="Delete tunnel" onClick={() => onDelete(tunnel)}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function TunnelCard({
  tunnel,
  uploading,
  onEdit,
  onDelete,
  onUpload,
}: {
  tunnel: AdminTunnel;
  uploading: boolean;
  onEdit: (tunnel: AdminTunnel) => void;
  onDelete: (tunnel: AdminTunnel) => void;
  onUpload: (tunnel: AdminTunnel, file: File | undefined) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex gap-3">
        {tunnel.header_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tunnel.header_image_url}
            alt=""
            className="h-20 w-24 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="h-20 w-24 shrink-0 rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-black text-slate-950">
            {tunnel.name}
          </h3>
          <p className="text-sm font-semibold text-slate-500">
            {tunnel.city}, {tunnel.country}
          </p>
          <p className="text-xs font-bold text-sky-700">{tunnel.region ?? "-"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ImageUploader tunnel={tunnel} uploading={uploading} onUpload={onUpload} />
        <IconButton label="Edit tunnel" onClick={() => onEdit(tunnel)}>
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete tunnel" onClick={() => onDelete(tunnel)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </article>
  );
}

function ImageUploader({
  tunnel,
  uploading,
  onUpload,
}: {
  tunnel: AdminTunnel;
  uploading: boolean;
  onUpload: (tunnel: AdminTunnel, file: File | undefined) => void;
}) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
      <Upload size={14} />
      {uploading ? "Uploading..." : tunnel.header_image_url ? "Replace" : "Upload"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => onUpload(tunnel, event.target.files?.[0])}
      />
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600"
    >
      {children}
    </button>
  );
}

function TunnelFormFields({
  draft,
  setDraft,
}: {
  draft: TunnelDraft;
  setDraft: (draft: TunnelDraft) => void;
}) {
  function update<K extends keyof TunnelDraft>(key: K, value: TunnelDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="Name" required>
        <input
          className="field"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </Field>
      <Field label="Region" required>
        <input
          className="field"
          value={draft.region ?? ""}
          onChange={(event) => update("region", event.target.value)}
        />
      </Field>
      <Field label="Country" required>
        <input
          className="field"
          value={draft.country}
          onChange={(event) => update("country", event.target.value)}
        />
      </Field>
      <Field label="City" required>
        <input
          className="field"
          value={draft.city}
          onChange={(event) => update("city", event.target.value)}
        />
      </Field>
      <Field label="Address">
        <input
          className="field"
          value={draft.address ?? ""}
          onChange={(event) => update("address", event.target.value)}
        />
      </Field>
      <Field label="Website">
        <input
          className="field"
          value={draft.website ?? ""}
          onChange={(event) => update("website", event.target.value)}
        />
      </Field>
      <Field label="Size">
        <input
          className="field"
          value={draft.size ?? ""}
          onChange={(event) => update("size", event.target.value)}
        />
      </Field>
      <Field label="Header image URL">
        <input
          className="field"
          value={draft.header_image_url ?? ""}
          onChange={(event) => update("header_image_url", event.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <textarea
            className="field min-h-24 py-3"
            value={draft.description ?? ""}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Wind quality notes">
          <textarea
            className="field min-h-20 py-3"
            value={draft.wind_quality_notes ?? ""}
            onChange={(event) =>
              update("wind_quality_notes", event.target.value)
            }
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function cleanTunnelDraft(draft: TunnelDraft) {
  return {
    name: draft.name.trim(),
    country: draft.country.trim(),
    city: draft.city.trim(),
    address: cleanText(draft.address),
    website: cleanText(draft.website),
    description: cleanText(draft.description),
    wind_quality_notes: cleanText(draft.wind_quality_notes),
    size: cleanText(draft.size),
    region: cleanText(draft.region),
    header_image_url: cleanText(draft.header_image_url),
    verified: true,
  };
}

function cleanText(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function formatRole(user: AdminUserOverview) {
  const isCoach =
    user.is_organizer === true || user.wants_to_create_opportunities === true;

  return isCoach ? "Athlete + Coach" : "Athlete";
}
