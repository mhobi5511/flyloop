"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { addTunnel, publishOpportunity } from "@/app/app/create/actions";
import { regions } from "@/lib/location";
import type { OpportunityType } from "@/lib/types";

export type TunnelOption = {
  id: string;
  name: string;
  city: string;
  country: string;
};

type CreateOpportunityFormProps = {
  tunnels: TunnelOption[];
};

const currencies = ["EUR", "CHF", "USD", "PLN", "GBP"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function CreateOpportunityForm({ tunnels }: CreateOpportunityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<OpportunityType>("camp");
  const [title, setTitle] = useState("");
  const [tunnelId, setTunnelId] = useState("");
  const [startDate, setStartDate] = useState(isoDateFromNow(5));
  const [endDate, setEndDate] = useState(addDays(isoDateFromNow(5), 5));
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [price, setPrice] = useState("420");
  const [currency, setCurrency] = useState("EUR");
  const [totalCapacity, setTotalCapacity] = useState("8");
  const [minMinutesOrHours, setMinMinutesOrHours] = useState("");
  const [description, setDescription] = useState("");
  const [languages, setLanguages] = useState("");
  const [disciplines, setDisciplines] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [availableTunnels, setAvailableTunnels] = useState(tunnels);
  const [showTunnelForm, setShowTunnelForm] = useState(false);
  const [tunnelName, setTunnelName] = useState("");
  const [tunnelCity, setTunnelCity] = useState("");
  const [tunnelCountry, setTunnelCountry] = useState("");
  const [tunnelRegion, setTunnelRegion] = useState("");
  const [tunnelAddress, setTunnelAddress] = useState("");
  const [tunnelWebsite, setTunnelWebsite] = useState("");
  const [tunnelDescription, setTunnelDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTunnel = useMemo(
    () => availableTunnels.find((tunnel) => tunnel.id === tunnelId),
    [availableTunnels, tunnelId],
  );
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
      const result = await publishOpportunity({
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
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push("/app");
      router.refresh();
    });
  }

  function submitTunnel() {
    setError("");
    setMessage("");

    if (!tunnelName.trim() || !tunnelCity.trim() || !tunnelCountry.trim()) {
      setError("Please enter the tunnel name, city and country.");
      return;
    }

    startTransition(async () => {
      const result = await addTunnel({
        name: tunnelName,
        city: tunnelCity,
        country: tunnelCountry,
        region: tunnelRegion,
        address: tunnelAddress,
        website: tunnelWebsite,
        description: tunnelDescription,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const newTunnel = {
        id: result.data.id,
        name: result.data.name,
        city: tunnelCity.trim(),
        country: tunnelCountry.trim(),
      };
      setAvailableTunnels((current) =>
        [...current, newTunnel].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setTunnelId(result.data.id);
      setTunnelName("");
      setTunnelCity("");
      setTunnelCountry("");
      setTunnelRegion("");
      setTunnelAddress("");
      setTunnelWebsite("");
      setTunnelDescription("");
      setShowTunnelForm(false);
      setMessage("Tunnel added and selected.");
    });
  }

  return (
    <form
      className="mt-5 grid w-full max-w-full gap-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SectionTitle eyebrow="Basic info" title="What are you publishing?" />
      <div className="grid gap-4 sm:grid-cols-2">
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
      <div className="grid gap-3">
        <Field label="Tunnel" required>
          <select
            className="field"
            value={tunnelId}
            onChange={(event) => setTunnelId(event.target.value)}
          >
            <option value="">Select a tunnel</option>
            {availableTunnels.map((tunnel) => (
              <option key={tunnel.id} value={tunnel.id}>
                {tunnel.name} - {tunnel.city}, {tunnel.country}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="max-w-full justify-self-start text-left text-sm font-bold text-sky-700"
          onClick={() => setShowTunnelForm((current) => !current)}
        >
          If your tunnel is missing, add it here.
        </button>
        {showTunnelForm ? (
          <div className="grid min-w-0 gap-4 border-l-2 border-sky-100 pl-3 sm:pl-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tunnel name" required>
                <input
                  className="field"
                  value={tunnelName}
                  onChange={(event) => setTunnelName(event.target.value)}
                />
              </Field>
              <Field label="City" required>
                <input
                  className="field"
                  value={tunnelCity}
                  onChange={(event) => setTunnelCity(event.target.value)}
                />
              </Field>
              <Field label="Country" required>
                <input
                  className="field"
                  value={tunnelCountry}
                  onChange={(event) => setTunnelCountry(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Region">
              <select
                className="field"
                value={tunnelRegion}
                onChange={(event) => setTunnelRegion(event.target.value)}
              >
                <option value="">Infer from country when possible</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address">
                <input
                  className="field"
                  value={tunnelAddress}
                  onChange={(event) => setTunnelAddress(event.target.value)}
                />
              </Field>
              <Field label="Website">
                <input
                  className="field"
                  value={tunnelWebsite}
                  onChange={(event) => setTunnelWebsite(event.target.value)}
                  placeholder="https://"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className="field min-h-24 py-3"
                value={tunnelDescription}
                onChange={(event) => setTunnelDescription(event.target.value)}
              />
            </Field>
            <button
              type="button"
              disabled={isPending}
              onClick={submitTunnel}
              className="h-11 w-full justify-self-start rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:bg-slate-300 sm:w-auto"
            >
              {isPending ? "Saving..." : "Add new tunnel"}
            </button>
          </div>
        ) : null}
      </div>

      <SectionTitle eyebrow="Dates" title="Set the timing" />
      {showLastMinuteNotice ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          This opportunity will appear as last-minute because the registration
          deadline is within 3 days and spots are still available.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date" required>
          <input
            type="date"
            className="field"
            value={startDate}
            onChange={(event) => updateStartDate(event.target.value)}
          />
        </Field>
        <Field label="End date" required>
          <input
            type="date"
            className="field"
            value={endDate}
            onChange={(event) => {
              setEndDateTouched(true);
              setEndDate(event.target.value);
            }}
          />
        </Field>
        <Field label="Registration deadline">
          <input
            type="date"
            className="field"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </Field>
      </div>

      <SectionTitle eyebrow="Price & capacity" title="Set availability" />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px_1fr]">
        <Field label="Price" required>
          <input
            type="number"
            min="0"
            step="1"
            className="field"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label="Currency" required>
          <select
            className="field"
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
        <Field label="Capacity" required>
          <input
            type="number"
            min="1"
            step="1"
            className="field"
            value={totalCapacity}
            onChange={(event) => setTotalCapacity(event.target.value)}
          />
        </Field>
      </div>

      <SectionTitle eyebrow="Details" title="Add useful context" />
      <div className="grid gap-4 sm:grid-cols-2">
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
      <Field label="Description">
        <textarea
          className="field min-h-28 py-3"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should flyers know before they send interest?"
        />
      </Field>

      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 disabled:bg-slate-300"
      >
        {isPending ? "Publishing..." : "Publish opportunity"}
      </button>
    </form>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
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
    <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-700">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
