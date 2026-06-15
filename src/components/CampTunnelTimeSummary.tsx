import type { TunnelTimeStatus } from "@/lib/types";

type CampTunnelTimeSummaryProps = {
  status: TunnelTimeStatus | string | null | undefined;
  accountEmail?: string | null;
  title?: string;
};

export function CampTunnelTimeSummary({
  status,
  accountEmail,
  title = "Tunnel Time",
}: CampTunnelTimeSummaryProps) {
  const hasTunnelTime = status === "owns_tunnel_time";
  const isMissingTunnelTime = status === "needs_tunnel_time";

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      <div className="mt-2 grid gap-1.5">
        <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Tunnel Time:{" "}
          {hasTunnelTime ? "✅ Available" : isMissingTunnelTime ? "❌ Not Available" : "Not provided"}
        </p>
        {hasTunnelTime && accountEmail ? (
          <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Tunnel Account Email:{" "}
            <a
              href={`mailto:${accountEmail}`}
              className="font-black text-sky-700 hover:text-sky-800"
            >
              {accountEmail}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
