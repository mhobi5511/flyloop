"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  publishOpportunity,
  updateOpportunity,
  type OpportunityFormInput,
} from "@/app/app/create/actions";
import type { BookingMode, OpportunityType } from "@/lib/types";

export type TunnelOption = {
  id: string;
  name: string;
  city: string;
  country: string;
};

export type InheritedCoachProfile = {
  languages: string[];
  disciplines: string[];
};

type CreateOpportunityFormProps = {
  tunnels: TunnelOption[];
  inheritedCoachProfile?: InheritedCoachProfile;
  initialOpportunity?: OpportunityFormInput & { id: string };
  mode?: "create" | "edit";
};

type StepId =
  | "type"
  | "basics"
  | "location"
  | "schedule"
  | "capacity"
  | "pricing"
  | "participation"
  | "review";

const currencies = ["EUR", "CHF", "USD", "PLN", "GBP"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fieldClass =
  "block h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-base font-medium outline-none placeholder:text-slate-400 focus:border-sky-400 focus:placeholder:text-transparent";
const dateFieldClass =
  "block box-border h-10 w-full max-w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white px-2.5 text-base font-medium leading-none outline-none [color-scheme:light] focus:border-sky-400";
const areaClass =
  "block min-h-20 w-full max-w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base font-medium outline-none placeholder:text-slate-400 focus:border-sky-400 focus:placeholder:text-transparent";

const campSteps: { id: StepId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "schedule", label: "Schedule" },
  { id: "capacity", label: "Capacity" },
  { id: "pricing", label: "Pricing" },
  { id: "review", label: "Review" },
];

const huckJamSteps: { id: StepId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "schedule", label: "Session" },
  { id: "participation", label: "Participation" },
  { id: "review", label: "Review" },
];

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

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const priceAppliesToErrorMessage =
  "Enter a number of minutes, for example 60. Price is normally per hour; use this field when another duration applies.";

function getPriceAppliesToError(value: string) {
  const trimmed = value.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return priceAppliesToErrorMessage;
  }

  const minutes = Number(trimmed);
  return Number.isFinite(minutes) && minutes > 0
    ? ""
    : priceAppliesToErrorMessage;
}

function normalizeInitialPriceAppliesTo(value?: string) {
  const trimmed = value?.trim() ?? "";
  return getPriceAppliesToError(trimmed) ? "60" : trimmed;
}

function formatDate(value: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(amount: string, currency: string) {
  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return `${amount || "0"} ${currency}`;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(number);
}

export function CreateOpportunityForm({
  tunnels,
  inheritedCoachProfile,
  initialOpportunity,
  mode = "create",
}: CreateOpportunityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inheritedLanguages =
    inheritedCoachProfile?.languages ?? splitCsv(initialOpportunity?.languages ?? "");
  const inheritedDisciplines =
    inheritedCoachProfile?.disciplines ??
    splitCsv(initialOpportunity?.disciplines ?? "");
  const [type, setType] = useState<OpportunityType>(
    initialOpportunity?.type ?? "camp",
  );
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialOpportunity?.type === "huck_jam"
      ? "approval_required"
      : (initialOpportunity?.bookingMode ?? "approval_required"),
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
  const [sessionStart] = useState(
    initialOpportunity?.sessionStart?.slice(0, 5) ?? "18:00",
  );
  const [sessionEnd] = useState(
    initialOpportunity?.sessionEnd?.slice(0, 5) ?? "20:00",
  );
  const [price, setPrice] = useState(
    String(initialOpportunity?.price ?? (type === "huck_jam" ? "50" : "550")),
  );
  const [currency, setCurrency] = useState(initialOpportunity?.currency ?? "EUR");
  const [totalCapacity, setTotalCapacity] = useState(
    String(initialOpportunity?.totalCapacity ?? "8"),
  );
  const [minMinutesOrHours, setMinMinutesOrHours] = useState(
    normalizeInitialPriceAppliesTo(initialOpportunity?.minMinutesOrHours),
  );
  const [description, setDescription] = useState(
    initialOpportunity?.description ?? "",
  );
  const [skillLevel] = useState(initialOpportunity?.skillLevel ?? "");
  const [tunnelSearch, setTunnelSearch] = useState("");
  const [isTunnelListOpen, setIsTunnelListOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(
    mode === "edit" ? campSteps.length - 1 : 0,
  );
  const [error, setError] = useState("");

  const steps = type === "camp" ? campSteps : huckJamSteps;
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const selectedTunnel = useMemo(
    () => tunnels.find((tunnel) => tunnel.id === tunnelId),
    [tunnels, tunnelId],
  );
  const tunnelMatches = useMemo(() => {
    const query = tunnelSearch.trim().toLowerCase();

    if (!query) {
      return tunnels.slice(0, 8);
    }

    return tunnels
      .filter((tunnel) =>
        `${tunnel.name} ${tunnel.city} ${tunnel.country}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [tunnels, tunnelSearch]);
  const capacityNumber = Number(totalCapacity);
  const showLastMinuteNotice = useMemo(() => {
    if (!registrationDeadline || !Number.isFinite(capacityNumber) || capacityNumber < 1) {
      return false;
    }

    const diff = daysUntil(registrationDeadline);
    return diff >= 0 && diff <= 3;
  }, [registrationDeadline, capacityNumber]);
  const priceAppliesToError =
    type === "camp" ? getPriceAppliesToError(minMinutesOrHours) : "";
  const flowName = type === "camp" ? "Camp" : "Huck Jam";

  function goToStep(nextIndex: number) {
    setError("");
    setStepIndex(Math.min(nextIndex, steps.length - 1));
  }

  function updateType(nextType: OpportunityType) {
    setType(nextType);
    setStepIndex(0);
    setMaxVisitedStepIndex(0);
    setError("");

    if (nextType === "huck_jam") {
      setBookingMode("approval_required");
      setEndDate(startDate);
      if (!initialOpportunity) {
        setPrice("50");
      }
    } else if (!initialOpportunity) {
      setPrice("550");
      setMinMinutesOrHours("60");
    }

    if (!endDateTouched && startDate) {
      setEndDate(nextType === "camp" ? addDays(startDate, 5) : startDate);
    }
  }

  function updateStartDate(value: string) {
    setStartDate(value);
    if (type === "huck_jam") {
      setEndDate(value);
    } else if (!endDateTouched) {
      setEndDate(addDays(value, 5));
    }
  }

  function validateStep(stepId: StepId) {
    if (stepId === "type" && type !== "camp" && type !== "huck_jam") {
      return "Choose Camp or Huck Jam to continue.";
    }

    if (stepId === "location" && !uuidPattern.test(tunnelId)) {
      return "Select the tunnel where this takes place.";
    }

    if (stepId === "schedule") {
      if (!isValidDate(startDate)) {
        return type === "huck_jam"
          ? "Select the event date."
          : "Select the start date.";
      }

      if (type === "camp" && !isValidDate(endDate)) {
        return "Select the end date.";
      }

      if (type === "camp" && new Date(endDate) < new Date(startDate)) {
        return "End date must be the same as or after the start date.";
      }

      if (
        registrationDeadline &&
        (!isValidDate(registrationDeadline) ||
          new Date(registrationDeadline) > new Date(startDate))
      ) {
        return type === "huck_jam"
          ? "Registration deadline must be on or before the event date."
          : "Registration deadline must be on or before the start date.";
      }
    }

    if (stepId === "capacity" || stepId === "participation") {
      const capacity = Number(totalCapacity);
      if (!Number.isInteger(capacity) || capacity < 1) {
        return "Enter a maximum participant count of at least 1.";
      }

      const fee = Number(price);
      if (!Number.isFinite(fee) || fee < 0) {
        return type === "huck_jam"
          ? "Enter a valid participation fee."
          : "Enter a valid price.";
      }
    }

    if (stepId === "pricing") {
      const fee = Number(price);
      if (!Number.isFinite(fee) || fee < 0) {
        return "Enter a valid price.";
      }

      if (priceAppliesToError) {
        return priceAppliesToError;
      }

      if (!currencies.includes(currency)) {
        return "Choose a valid currency.";
      }
    }

    return "";
  }

  function validateAll() {
    for (const step of steps) {
      const validationError = validateStep(step.id);
      if (validationError) {
        return validationError;
      }
    }

    return "";
  }

  function continueToNextStep() {
    const validationError = validateStep(currentStep.id);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    setError("");
    setStepIndex(nextIndex);
    setMaxVisitedStepIndex((value) => Math.max(value, nextIndex));
  }

  function submit() {
    const validationError = validateAll();

    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const effectiveEndDate = type === "huck_jam" ? startDate : endDate;
      const values = {
        type,
        bookingMode: type === "huck_jam" ? "approval_required" : bookingMode,
        title,
        tunnelId,
        startDate,
        endDate: effectiveEndDate,
        registrationDeadline,
        sessionStart,
        sessionEnd,
        price: Number(price),
        currency,
        totalCapacity: Number(totalCapacity),
        minMinutesOrHours: type === "camp" ? minMinutesOrHours.trim() : "",
        description,
        languages: inheritedLanguages.join(", "),
        disciplines: inheritedDisciplines.join(", "),
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
          : `/app/organizer/opportunities/${result.data.id}?published=1`,
      );
      router.refresh();
    });
  }

  return (
    <form
      className="mt-3 grid w-full gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (currentStep.id === "review") {
          submit();
        } else {
          continueToNextStep();
        }
      }}
    >
      <ProgressNav
        steps={steps}
        currentIndex={stepIndex}
        maxVisitedIndex={maxVisitedStepIndex}
        onSelect={goToStep}
      />

      <div className="rounded-xl bg-slate-50/70 p-3 sm:p-4">
        {currentStep.id === "type" ? (
          <TypeStep type={type} onChange={updateType} />
        ) : null}

        {currentStep.id === "basics" ? (
          <BasicsStep
            type={type}
            title={title}
            description={description}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
          />
        ) : null}

        {currentStep.id === "location" ? (
          <LocationStep
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
        ) : null}

        {currentStep.id === "schedule" ? (
          <ScheduleStep
            type={type}
            startDate={startDate}
            endDate={endDate}
            registrationDeadline={registrationDeadline}
            showLastMinuteNotice={showLastMinuteNotice}
            onStartDateChange={updateStartDate}
            onEndDateChange={(value) => {
              setEndDateTouched(true);
              setEndDate(value);
            }}
            onRegistrationDeadlineChange={setRegistrationDeadline}
          />
        ) : null}

        {currentStep.id === "capacity" ? (
          <CapacityStep
            bookingMode={bookingMode}
            totalCapacity={totalCapacity}
            onBookingModeChange={setBookingMode}
            onCapacityChange={setTotalCapacity}
          />
        ) : null}

        {currentStep.id === "pricing" ? (
          <PricingStep
            price={price}
            currency={currency}
            minMinutesOrHours={minMinutesOrHours}
            priceAppliesToError={priceAppliesToError}
            onPriceChange={setPrice}
            onCurrencyChange={setCurrency}
            onMinMinutesOrHoursChange={setMinMinutesOrHours}
          />
        ) : null}

        {currentStep.id === "participation" ? (
          <ParticipationStep
            price={price}
            currency={currency}
            totalCapacity={totalCapacity}
            onPriceChange={setPrice}
            onCurrencyChange={setCurrency}
            onCapacityChange={setTotalCapacity}
          />
        ) : null}

        {currentStep.id === "review" ? (
          <ReviewStep
            type={type}
            title={title}
            selectedTunnel={selectedTunnel}
            startDate={startDate}
            endDate={endDate}
            registrationDeadline={registrationDeadline}
            totalCapacity={totalCapacity}
            bookingMode={bookingMode}
            price={price}
            currency={currency}
            minMinutesOrHours={minMinutesOrHours}
            onEdit={(stepId) => {
              const nextIndex = steps.findIndex((step) => step.id === stepId);
              if (nextIndex >= 0) {
                goToStep(nextIndex);
              }
            }}
          />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 p-2.5 text-sm font-semibold leading-5 text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-row items-center justify-between gap-2">
        <button
          type="button"
          disabled={stepIndex === 0 || isPending}
          onClick={() => goToStep(Math.max(stepIndex - 1, 0))}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:px-4"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isPending || (currentStep.id === "pricing" && Boolean(priceAppliesToError))}
          className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 disabled:bg-slate-300 sm:px-5"
        >
          {currentStep.id === "review"
            ? isPending
              ? mode === "edit"
                ? "Saving..."
                : `Creating ${flowName}...`
              : mode === "edit"
                ? "Save changes"
                : `Create ${flowName}`
            : "Continue"}
        </button>
      </div>
    </form>
  );
}

function ProgressNav({
  steps,
  currentIndex,
  maxVisitedIndex,
  onSelect,
}: {
  steps: { id: StepId; label: string }[];
  currentIndex: number;
  maxVisitedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Create progress">
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-7">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const canSelect = index <= maxVisitedIndex;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!canSelect}
                onClick={() => onSelect(index)}
                className={`h-8 w-full truncate rounded-lg border px-2 text-[0.68rem] font-black transition sm:text-xs ${
                  isCurrent
                    ? "border-sky-600 bg-sky-600 text-white"
                    : canSelect
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                      : "border-slate-100 bg-slate-50 text-slate-300"
                }`}
              >
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-600">
        {eyebrow}
      </p>
      <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 hidden max-w-2xl text-sm font-medium leading-5 text-slate-600 sm:block">
        {description}
      </p>
    </div>
  );
}

function TypeStep({
  type,
  onChange,
}: {
  type: OpportunityType;
  onChange: (type: OpportunityType) => void;
}) {
  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Type"
        title="What would you like to create?"
        description="Start with the format. You can still review everything before publishing."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <TypeCard
          selected={type === "camp"}
          title="Camp"
          description="A multi-day coaching opportunity with capacity, booking mode and hourly pricing."
          onClick={() => onChange("camp")}
        />
        <TypeCard
          selected={type === "huck_jam"}
          title="Huck Jam"
          description="A single-day session with a participation fee and a simple sign-up flow."
          onClick={() => onChange("huck_jam")}
        />
      </div>
    </div>
  );
}

function TypeCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid min-h-24 gap-1.5 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-sky-400 bg-sky-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-white"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-lg font-black tracking-tight text-slate-950">
          {title}
        </span>
        <span
          className={`grid size-5 place-items-center rounded-full border text-sm font-black ${
            selected
              ? "border-sky-600 bg-sky-600 text-white"
              : "border-slate-200 text-transparent"
          }`}
        />
      </span>
      <span className="hidden text-sm font-medium leading-5 text-slate-600 sm:block">
        {description}
      </span>
    </button>
  );
}

function BasicsStep({
  type,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: {
  type: OpportunityType;
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  const label = type === "camp" ? "Camp" : "Huck Jam";

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Basics"
        title={`${label} details`}
        description="Name and description are optional. Languages and disciplines come from your coach profile."
      />
      <div className="grid gap-2.5">
        <Field label={`${label} Name`}>
          <input
            className={fieldClass}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={`Optional ${label.toLowerCase()} name`}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={areaClass}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Optional notes for flyers"
          />
        </Field>
      </div>
    </div>
  );
}

function LocationStep({
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
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Location"
        title="Where will it happen?"
        description="Choose the tunnel so flyers can discover the opportunity in the right place."
      />
      <TunnelCombobox
        matches={matches}
        selectedTunnel={selectedTunnel}
        tunnelSearch={tunnelSearch}
        isOpen={isOpen}
        onSearch={onSearch}
        onFocus={onFocus}
        onSelect={onSelect}
      />
    </div>
  );
}

function ScheduleStep({
  type,
  startDate,
  endDate,
  registrationDeadline,
  showLastMinuteNotice,
  onStartDateChange,
  onEndDateChange,
  onRegistrationDeadlineChange,
}: {
  type: OpportunityType;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  showLastMinuteNotice: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRegistrationDeadlineChange: (value: string) => void;
}) {
  const isHuckJam = type === "huck_jam";

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow={isHuckJam ? "Session" : "Schedule"}
        title={isHuckJam ? "Set the event date" : "Set the camp dates"}
        description={
          isHuckJam
            ? "Huck Jams happen on one day. Leave registration deadline empty to keep sign-up open until the event starts."
            : "Leave registration deadline empty to keep registration open until the camp starts."
        }
      />
      {showLastMinuteNotice ? (
        <p className="rounded-lg bg-amber-50 p-2.5 text-sm font-semibold leading-5 text-amber-800">
          This opportunity will appear as last-minute because the registration
          deadline is within 3 days and spots are still available.
        </p>
      ) : null}
      <div
        className={
          isHuckJam
            ? "grid gap-2.5"
            : "grid min-w-0 gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        }
      >
        <Field label={isHuckJam ? "Event Date" : "Start Date"} required>
          <input
            type="date"
            className={dateFieldClass}
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </Field>
        {!isHuckJam ? (
          <Field label="End Date" required>
            <input
              type="date"
              className={dateFieldClass}
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </Field>
        ) : null}
      </div>
      <Field label="Registration Deadline">
        <input
          type="date"
          className={dateFieldClass}
          value={registrationDeadline}
          onChange={(event) => onRegistrationDeadlineChange(event.target.value)}
        />
      </Field>
    </div>
  );
}

function CapacityStep({
  bookingMode,
  totalCapacity,
  onBookingModeChange,
  onCapacityChange,
}: {
  bookingMode: BookingMode;
  totalCapacity: string;
  onBookingModeChange: (value: BookingMode) => void;
  onCapacityChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Capacity"
        title="How should booking work?"
        description="Keep the existing booking behavior, then set the maximum number of participants."
      />
      <Field label="Maximum Participants" required>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={fieldClass}
          value={totalCapacity}
          onChange={(event) => onCapacityChange(event.target.value)}
        />
      </Field>
      <div className="grid gap-2 md:grid-cols-2">
        <BookingModeOption
          value="approval_required"
          selectedValue={bookingMode}
          title="Approval Required"
          description="Participants apply first. You decide who gets accepted. Accepted participants can then select times."
          onChange={onBookingModeChange}
        />
        <BookingModeOption
          value="direct_time_booking"
          selectedValue={bookingMode}
          title="Direct Booking"
          description="Participants can immediately select available times. Booking a slot confirms participation."
          onChange={onBookingModeChange}
        />
      </div>
    </div>
  );
}

function PricingStep({
  price,
  currency,
  minMinutesOrHours,
  priceAppliesToError,
  onPriceChange,
  onCurrencyChange,
  onMinMinutesOrHoursChange,
}: {
  price: string;
  currency: string;
  minMinutesOrHours: string;
  priceAppliesToError: string;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onMinMinutesOrHoursChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Pricing"
        title="Set the price"
        description="Price is normally per hour. The duration field must contain a valid number of minutes."
      />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
        <Field label="Price" required>
          <input
            type="number"
            min="0"
            step="1"
            className={fieldClass}
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
          />
        </Field>
        <Field label="Currency" required>
          <select
            className={fieldClass}
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          >
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Price Applies To" required>
        <input
          inputMode="decimal"
          className={fieldClass}
          value={minMinutesOrHours}
          onBlur={() => {
            if (!minMinutesOrHours.trim()) {
              onMinMinutesOrHoursChange("60");
            }
          }}
          onChange={(event) => onMinMinutesOrHoursChange(event.target.value)}
          placeholder="60"
          aria-invalid={Boolean(priceAppliesToError)}
        />
      <span className="text-xs font-semibold leading-4 text-slate-500">
        Displayed as {formatCurrency(price || "0", currency)} per{" "}
        {minMinutesOrHours || "60"} minutes.
      </span>
        {priceAppliesToError ? (
          <span className="text-xs font-bold leading-5 text-rose-600">
            {priceAppliesToError}
          </span>
        ) : null}
      </Field>
    </div>
  );
}

function ParticipationStep({
  price,
  currency,
  totalCapacity,
  onPriceChange,
  onCurrencyChange,
  onCapacityChange,
}: {
  price: string;
  currency: string;
  totalCapacity: string;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onCapacityChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Participation"
        title="Set capacity and fee"
        description="Participation fee represents entry to this Huck Jam session."
      />
      <Field label="Maximum Participants" required>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={fieldClass}
          value={totalCapacity}
          onChange={(event) => onCapacityChange(event.target.value)}
        />
      </Field>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
        <Field label="Participation Fee" required>
          <input
            type="number"
            min="0"
            step="1"
            className={fieldClass}
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
          />
        </Field>
        <Field label="Currency" required>
          <select
            className={fieldClass}
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          >
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({
  type,
  title,
  selectedTunnel,
  startDate,
  endDate,
  registrationDeadline,
  totalCapacity,
  bookingMode,
  price,
  currency,
  minMinutesOrHours,
  onEdit,
}: {
  type: OpportunityType;
  title: string;
  selectedTunnel?: TunnelOption;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  totalCapacity: string;
  bookingMode: BookingMode;
  price: string;
  currency: string;
  minMinutesOrHours: string;
  onEdit: (stepId: StepId) => void;
}) {
  const isHuckJam = type === "huck_jam";
  const name = title.trim() || "Generated after publishing";
  const reviewGroups = isHuckJam
    ? [
        {
          title: "Basics",
          stepId: "basics" as StepId,
          items: [{ label: "Name", value: name }],
        },
        {
          title: "Location",
          stepId: "location" as StepId,
          items: [
            {
              label: "Tunnel",
              value: selectedTunnel
                ? `${selectedTunnel.name}, ${selectedTunnel.city}`
                : "Not set",
            },
          ],
        },
        {
          title: "Session",
          stepId: "schedule" as StepId,
          items: [
            { label: "Event Date", value: formatDate(startDate) },
            {
              label: "Registration Deadline",
              value: registrationDeadline
                ? formatDate(registrationDeadline)
                : "Open until event start",
            },
          ],
        },
        {
          title: "Participation",
          stepId: "participation" as StepId,
          items: [
            { label: "Capacity", value: totalCapacity },
            {
              label: "Fee",
              value: formatCurrency(price, currency),
            },
          ],
        },
      ]
    : [
        {
          title: "Basics",
          stepId: "basics" as StepId,
          items: [{ label: "Camp Name", value: name }],
        },
        {
          title: "Location",
          stepId: "location" as StepId,
          items: [
            {
              label: "Tunnel",
              value: selectedTunnel
                ? `${selectedTunnel.name}, ${selectedTunnel.city}`
                : "Not set",
            },
          ],
        },
        {
          title: "Schedule",
          stepId: "schedule" as StepId,
          items: [
            { label: "Start Date", value: formatDate(startDate) },
            { label: "End Date", value: formatDate(endDate) },
            {
              label: "Registration Deadline",
              value: registrationDeadline
                ? formatDate(registrationDeadline)
                : "Open until camp start",
            },
          ],
        },
        {
          title: "Capacity",
          stepId: "capacity" as StepId,
          items: [
            { label: "Maximum Participants", value: totalCapacity },
            {
              label: "Booking Mode",
              value:
                bookingMode === "direct_time_booking"
                  ? "Direct Booking"
                  : "Approval Required",
            },
          ],
        },
        {
          title: "Pricing",
          stepId: "pricing" as StepId,
          items: [
            { label: "Price", value: formatCurrency(price, currency) },
            {
              label: "Applies To",
              value: `${minMinutesOrHours || "60"} minutes`,
            },
          ],
        },
      ];

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Review"
        title={`Ready to create this ${isHuckJam ? "Huck Jam" : "camp"}?`}
        description="Check each section, make grouped edits, then publish when it looks right."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {reviewGroups.map((group) => (
          <div
            key={`${group.title}-${group.stepId}`}
            className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-950">
                {group.title}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(group.stepId)}
                className="h-7 rounded-md border border-slate-200 px-2 text-xs font-black text-sky-700 hover:bg-sky-50"
              >
                Edit
              </button>
            </div>
            <dl className="grid gap-1">
              {group.items.map((item) => (
                <div
                  key={`${group.title}-${item.label}`}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2"
                >
                  <dt className="truncate text-xs font-bold text-slate-400">
                    {item.label}
                  </dt>
                  <dd className="min-w-0 truncate text-xs font-black text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
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
    <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-700 sm:text-sm">
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
    <div className="grid min-w-0 gap-1 text-sm font-bold text-slate-700">
      <span>
        Tunnel <span className="text-rose-600">*</span>
      </span>
      <div className="relative">
        <input
          className={fieldClass}
          value={tunnelSearch}
          onChange={(event) => onSearch(event.target.value)}
          onFocus={onFocus}
          placeholder="Search tunnel, city or country"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="tunnel-options"
          autoComplete="off"
        />
        {selectedTunnel && !tunnelSearch ? (
          <p className="mt-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800">
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

function BookingModeOption({
  value,
  selectedValue,
  title,
  description,
  onChange,
}: {
  value: BookingMode;
  selectedValue: BookingMode;
  title: string;
  description: string;
  onChange: (value: BookingMode) => void;
}) {
  const isSelected = selectedValue === value;

  return (
    <label
      className={`grid cursor-pointer gap-1 rounded-xl border px-3 py-2.5 text-sm transition ${
        isSelected
          ? "border-sky-300 bg-sky-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-2 font-black text-slate-950">
        <input
          type="radio"
          name="bookingMode"
          value={value}
          checked={isSelected}
          onChange={() => onChange(value)}
          className="size-4 accent-sky-600"
        />
        {title}
      </span>
      <span className="pl-6 text-xs font-semibold leading-4 text-slate-600">
        {description}
      </span>
    </label>
  );
}
