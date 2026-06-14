import { formatCampDayPreferenceLabel, formatCampPreferenceMinutes } from "@/lib/camp-days";

type CampPreference = {
  dayId: number;
  preferredMinutes: number;
};

type CampPreferencesSummaryProps = {
  campStartDate: string;
  campEndDate: string;
  preferences: CampPreference[];
  emptyLabel?: string;
};

export function CampPreferencesSummary({
  campStartDate,
  campEndDate,
  preferences,
  emptyLabel = "No preferences submitted.",
}: CampPreferencesSummaryProps) {
  const sortedPreferences = [...preferences].sort((a, b) => a.dayId - b.dayId);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        Your Preferences
      </h3>
      <div className="mt-2 grid gap-1.5">
        {sortedPreferences.length > 0 ? (
          sortedPreferences.map((preference) => (
            <p
              key={preference.dayId}
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {formatCampDayPreferenceLabel(campStartDate, campEndDate, preference.dayId)}{" "}
              → {formatCampPreferenceMinutes(preference.preferredMinutes)}
            </p>
          ))
        ) : (
          <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}
