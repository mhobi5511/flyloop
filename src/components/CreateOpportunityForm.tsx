"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  publishOpportunity,
  updateOpportunity,
  type OpportunityFormInput,
} from "@/app/app/create/actions";
import type { OpportunityType } from "@/lib/types";

export type TunnelOption = {
  id: string;
  name: string;
  city: string;
  country: string;
};

type CreateOpportunityFormProps = {
  tunnels: TunnelOption[];
  initialOpportunity?: OpportunityFormInput & { id: string };
  mode?: "create" | "edit";
};

const currencies = ["EUR", "CHF", "USD", "PLN", "GBP"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const premiumFieldClass =
  "block h-[3.25rem] w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 text-base font-medium outline-none focus:border-sky-400";
const dateFieldClass =
  "box-border block h-14 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium leading-none outline-none focus:border-sky-400";

function isoDateFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateValue}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validateOpportunity(values: {
  type: OpportunityType;
  tunnelId: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  price: string;
  currency: string;
  totalCapacity: string;
}) {
  if (values.type !== "camp" && values.type !== "huck_jam") {
    return "Please choose an opportunity type.";
  }

  if (!uuidPattern.test(values.tunnelId)) {
    return "Please select a tunnel before publishing.";
  }

  if (!isValidDate(values.startDate)) {
    return "Please select a start date.";
  }

  if (!isValidDate(values.endDate)) {
    return "Please select an end date.";
  }

  if (new Date(values.endDate) < new Date(values.startDate)) {
    return "End date must be the same as or after the start date.";
  }

  if (
    values.registrationDeadline &&
    (!isValidDate(values.registrationDeadline) ||
      new Date(values.registrationDeadline) > new Date(values.startDate))
  ) {
    return "Registration deadline must be on or before the start date.";
  }

  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) {
    return "Please enter a valid price.";
  }

  if (!currencies.includes(values.currency)) {
    return "Please choose a valid currency.";
  }

  const capacity = Number(values.totalCapacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    return "Please enter a valid capacity.";
  }

  return "";
}

export function CreateOpportunityForm({
  tunnels,
  initialOpportunity,
  mode = "create",
}: CreateOpportunityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<OpportunityType>(
    initialOpportunity?.type ?? "camp",
  );
  const [title, setTitle] = useState(initialOpportunity?.title ?? "");
  const [tunnelId, setTunnelId] = useState(initialOpportunity?.tunnelId ?? "");
  const [startDate, setStartDate] = useState(
    initialOpportunity?.startDate ?? isoDateFromNow(5),
  );
  const [endDate, setEndDate] = useState(
    initialOpportunity?.endDate ??
      addDays(initialOpportunity?.startDate ?? isoDateFromNow(5), 5),
  );
  const [endDateTouched, setEndDateTouched] = useState(Boolean(initialOpportunity));
  const [registrationDeadline, setRegistrationDeadline] = useState(
    initialOpportunity?.registrationDeadline ?? "",
  );
  const [price, setPrice] = useState(String(initialOpportunity?.price ?? "420"));
  const [currency, setCurrency] = useState(initialOpportunity?.currency ?? "EUR");
  const [totalCapacity, setTotalCapacity] = useState(
    String(initialOpportunity?.totalCapacity ?? "8"),
  );
  const [minMinutesOrHours, setMinMinutesOrHours] = useState(
    initialOpportunity?.minMinutesOrHours ?? "",
  );
  const [description, setDescription] = useState(
    initialOpportunity?.description ?? "",
  );
  const [languages, setLanguages] = useState(initialOpportunity?.languages ?? "");
  const [disciplines, setDisciplines] = useState(
    initialOpportunity?.disciplines ?? "",
  );
  const [skillLevel, setSkillLevel] = useState(initialOpportunity?.skillLevel ?? "");
  const [availableTunnels] = useState(tunnels);
  const [tunnelSearch, setTunnelSearch] = useState("");
  const [isTunnelListOpen, setIsTunnelListOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(mode === "edit");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTunnel = useMemo(
    () => availableTunnels.find((tunnel) => tunnel.id === tunnelId),
    [availableTunnels, tunnelId],
  );
  const tunnelMatches = useMemo(() => {
    const query = tunnelSearch.trim().toLowerCase();

    if (!query) {
      return availableTunnels.slice(0, 8);
    }

    return availableTunnels
      .filter((tunnel) =>
        `${tunnel.name} ${tunnel.city} ${tunnel.country}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [availableTunnels, tunnelSearch]);
  const capacityNumber = Number(totalCapacity);
  const showLastMinuteNotice = useMemo(() => {
    if (!registrationDeadline || !Number.isFinite(capacityNumber) || capacityNumber < 1) {
      return false;
    }

    const diff = daysUntil(registrationDeadline);
    return diff >= 0 && diff <= 3;
  }, [registrationDeadline, capacityNumber]);

  function updateType(nextType: OpportunityType) {
    setType(nextType);
    if (!endDateTouched && startDate) {
      setEndDate(nextType === "camp" ? addDays(startDate, 5) : startDate);
    }
  }

  function updateStartDate(value: string) {
    setStartDate(value);
    if (!endDateTouched) {
      setEndDate(type === "camp" ? addDays(value, 5) : value);
    }
  }

  function submit() {
    setError("");
    setMessage("");

    const validationError = validateOpportunity({
      type,
      tunnelId,
      startDate,
      endDate,
      registrationDeadline,
      price,
      currency,
      totalCapacity,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const values = {
        type,
        title,
        tunnelId,
        startDate,
        endDate,
        registrationDeadline,
        price: Number(price),
        currency,
        totalCapacity: Number(totalCapacity),
        minMinutesOrHours,
        description,
        languages,
        disciplines,
        skillLevel,
      };
      const result =
        mode === "edit" && initialOpportunity
          ? await updateOpportunity(initialOpportunity.id, values)
          : await publishOpportunity(values);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(
        mode === "edit" && initialOpportunity
          ? `/app/organizer/opportunities/${initialOpportunity.id}`
          : "/app",
      );
      router.refresh();
    });
  }

  return (
    <form
      className="mt-3 grid w-full max-w-full gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:mt-4 sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SectionTitle eyebrow="Basic info" title="What are you publishing?" />
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Field label="Type" required>
          <select
            className="field"
            value={type}
            onChange={(event) => updateType(event.target.value as OpportunityType)}
          >
            <option value="camp">Camp</option>
            <option value="huck_jam">Huck Jam</option>
          </select>
        </Field>
        <Field label="Title">
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              type === "camp"
                ? "Optional, e.g. Dynamic Camp"
                : selectedTunnel
                  ? `Optional, e.g. Huck Jam at ${selectedTunnel.name}`
                  : "Optional"
            }
          />
        </Field>
      </div>

      <SectionTitle eyebrow="Location" title="Choose the tunnel" />
      <TunnelCombobox
        matches={tunnelMatches}
        selectedTunnel={selectedTunnel}
        tunnelSearch={tunnelSearch}
        isOpen={isTunnelListOpen}
        onSearch={(value) => {
          setTunnelSearch(value);
          setIsTunnelListOpen(true);
        }}
        onFocus={() => setIsTunnelListOpen(true)}
        onSelect={(tunnel) => {
          setTunnelId(tunnel.id);
          setTunnelSearch("");
          setIsTunnelListOpen(false);
        }}
      />

      <SectionTitle eyebrow="Dates" title="Set the timing" />
      {showLastMinuteNotice ? (
        <p className="rounded-xl bg-amber-50 p-2.5 text-xs font-semibold leading-5 text-amber-800 sm:p-3 sm:text-sm">
          This opportunity will appear as last-minute because the registration
          deadline is within 3 days and spots are still available.
        </p>
      ) : null}
      <div className="w-full max-w-full overflow-hidden">
        <div className="grid w-full min-w-0 grid-cols-2 gap-3">
          <Field label="Start date" required>
            <input
              type="date"
              className={dateFieldClass}
              value={startDate}
              onChange={(event) => updateStartDate(event.target.value)}
            />
          </Field>
          <Field label="End date" required>
            <input
              type="date"
              className={dateFieldClass}
              value={endDate}
              onChange={(event) => {
                setEndDateTouched(true);
                setEndDate(event.target.value);
              }}
            />
          </Field>
        </div>
        <div className="mt-3 w-full min-w-0">
          <Field label="Registration deadline">
            <input
              type="date"
              className={dateFieldClass}
              value={registrationDeadline}
              onChange={(event) => setRegistrationDeadline(event.target.value)}
            />
          </Field>
        </div>
      </div>

      <SectionTitle eyebrow="Price & capacity" title="Set availability" />
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
        <Field label="Price" required>
          <input
            type="number"
            min="0"
            step="1"
            className={premiumFieldClass}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label="Currency" required>
          <select
            className={premiumFieldClass}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Capacity" required>
            <input
              type="number"
              min="1"
              step="1"
              className={premiumFieldClass}
              value={totalCapacity}
              onChange={(event) => setTotalCapacity(event.target.value)}
            />
          </Field>
        </div>
      </div>

      <details
        className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3"
        open={isDetailsOpen}
        onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
          Optional details
        </summary>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <Field label="Minimum time">
            <input
              className="field"
              value={minMinutesOrHours}
              onChange={(event) => setMinMinutesOrHours(event.target.value)}
              placeholder={type === "camp" ? "45 min per athlete" : "10 min blocks"}
            />
          </Field>
          <Field label="Skill level">
            <input
              className="field"
              value={skillLevel}
              onChange={(event) => setSkillLevel(event.target.value)}
              placeholder={type === "camp" ? "Intermediate" : "All levels"}
            />
          </Field>
          <Field label="Languages">
            <input
              className="field"
              value={languages}
              onChange={(event) => setLanguages(event.target.value)}
              placeholder="English, German"
            />
          </Field>
          <Field label="Disciplines">
            <input
              className="field"
              value={disciplines}
              onChange={(event) => setDisciplines(event.target.value)}
              placeholder={type === "camp" ? "Dynamic, Angles" : "Belly, Backfly, Dynamic"}
            />
          </Field>
        </div>
        <div className="mt-2.5 sm:mt-3">
          <Field label="Description">
            <textarea
              className="field min-h-24 py-3"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should flyers know before they send interest?"
            />
          </Field>
        </div>
      </details>

      {message ? (
        <p className="rounded-xl bg-sky-50 p-2.5 text-sm font-semibold text-sky-700 sm:p-3">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-2.5 text-sm font-semibold text-rose-700 sm:p-3">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 disabled:bg-slate-300"
      >
        {isPending
          ? mode === "edit"
            ? "Saving..."
            : "Publishing..."
          : mode === "edit"
            ? "Save changes"
            : "Publish opportunity"}
      </button>
    </form>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-t border-slate-100 pt-1.5 first:border-t-0 first:pt-0 sm:pt-2">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-sky-600 sm:text-xs sm:tracking-[0.16em]">
        {eyebrow}
      </p>
      <h2 className="mt-0.5 text-lg font-black tracking-tight text-slate-950 sm:mt-1 sm:text-xl">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-0.5 text-xs font-bold text-slate-700 sm:gap-1 sm:text-sm">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function TunnelCombobox({
  matches,
  selectedTunnel,
  tunnelSearch,
  isOpen,
  onSearch,
  onFocus,
  onSelect,
}: {
  matches: TunnelOption[];
  selectedTunnel?: TunnelOption;
  tunnelSearch: string;
  isOpen: boolean;
  onSearch: (value: string) => void;
  onFocus: () => void;
  onSelect: (tunnel: TunnelOption) => void;
}) {
  return (
    <div className="grid min-w-0 gap-0.5 text-xs font-bold text-slate-700 sm:gap-1 sm:text-sm">
      <span>
        Tunnel <span className="text-rose-600">*</span>
      </span>
      <div className="relative">
        <input
          className="field"
          value={tunnelSearch}
          onChange={(event) => onSearch(event.target.value)}
          onFocus={onFocus}
          placeholder={
            selectedTunnel
              ? `${selectedTunnel.name} - ${selectedTunnel.city}, ${selectedTunnel.country}`
              : "Search tunnel, city or country"
          }
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="tunnel-options"
          autoComplete="off"
        />
        {selectedTunnel && !tunnelSearch ? (
          <p className="mt-1 text-xs font-semibold text-sky-700">
            Selected: {selectedTunnel.name}, {selectedTunnel.city}
          </p>
        ) : null}
        {isOpen ? (
          <div
            id="tunnel-options"
            role="listbox"
            className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {matches.length > 0 ? (
              matches.map((tunnel) => (
                <button
                  key={tunnel.id}
                  type="button"
                  role="option"
                  aria-selected={selectedTunnel?.id === tunnel.id}
                  className="grid w-full gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-sky-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(tunnel)}
                >
                  <span className="text-sm font-black text-slate-900">
                    {tunnel.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {tunnel.city}, {tunnel.country}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm font-semibold text-slate-500">
                No admin-created tunnel matches.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
