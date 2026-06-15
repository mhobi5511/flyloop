"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, CircleDollarSign, ClipboardCheck, MapPin, Users } from "lucide-react";
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
  organizerName?: string;
  initialOpportunity?: OpportunityFormInput & { id: string };
  initialType?: OpportunityType;
  mode?: "create" | "edit";
  onCancel?: () => void;
  onSuccess?: (opportunityId: string) => void;
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
  "block box-border h-9 w-full max-w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white px-9 pr-2.5 text-sm font-bold leading-none outline-none [color-scheme:light] focus:border-sky-400";
const areaClass =
  "block min-h-20 w-full max-w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base font-medium outline-none placeholder:text-slate-400 focus:border-sky-400 focus:placeholder:text-transparent";

const campSteps: { id: StepId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "schedule", label: "Schedule" },
  { id: "pricing", label: "Pricing" },
  { id: "capacity", label: "Capacity" },
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

function nextMondayIsoDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  date.setDate(date.getDate() + daysUntilMonday);
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

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
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

function formatSessionTime(value: string) {
  return value.slice(0, 5);
}

function fallbackOpportunityName(type: OpportunityType, organizerName?: string) {
  return `${type === "camp" ? "Camp" : "Huck Jam"} with ${
    organizerName?.trim() || "Flyloop organizer"
  }`;
}

export function CreateOpportunityForm({
  tunnels,
  inheritedCoachProfile,
  organizerName,
  initialOpportunity,
  initialType,
  mode = "create",
  onCancel,
  onSuccess,
}: CreateOpportunityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const defaultCampStartDate = nextMondayIsoDate();
  const defaultCampEndDate = addDays(defaultCampStartDate, 4);
  const inheritedLanguages =
    inheritedCoachProfile?.languages ?? splitCsv(initialOpportunity?.languages ?? "");
  const inheritedDisciplines =
    inheritedCoachProfile?.disciplines ??
    splitCsv(initialOpportunity?.disciplines ?? "");
  const initialFormType = initialOpportunity?.type ?? initialType ?? "camp";
  const [type, setType] = useState<OpportunityType>(
    initialFormType,
  );
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialOpportunity?.type === "huck_jam"
      ? "approval_required"
      : (initialOpportunity?.bookingMode ?? "approval_required"),
  );
  const [title, setTitle] = useState(initialOpportunity?.title ?? "");
  const [tunnelId, setTunnelId] = useState(initialOpportunity?.tunnelId ?? "");
  const [startDate, setStartDate] = useState(
    initialOpportunity?.startDate ??
      (initialFormType === "camp" ? defaultCampStartDate : isoDateFromNow(5)),
  );
  const [endDate, setEndDate] = useState(
    initialOpportunity?.endDate ??
      (initialFormType === "camp"
        ? defaultCampEndDate
        : addDays(initialOpportunity?.startDate ?? isoDateFromNow(5), 5)),
  );
  const [endDateTouched, setEndDateTouched] = useState(Boolean(initialOpportunity));
  const [registrationDeadline, setRegistrationDeadline] = useState(
    initialOpportunity?.registrationDeadline ?? "",
  );
  const [sessionStart, setSessionStart] = useState(
    initialOpportunity?.sessionStart?.slice(0, 5) ?? "18:00",
  );
  const [sessionEnd, setSessionEnd] = useState(
    initialOpportunity?.sessionEnd?.slice(0, 5) ?? "20:00",
  );
  const [price, setPrice] = useState(
    String(initialOpportunity?.price ?? (initialFormType === "huck_jam" ? "99" : "550")),
  );
  const [currency, setCurrency] = useState(initialOpportunity?.currency ?? "EUR");
  const [totalCapacity, setTotalCapacity] = useState(
    String(initialOpportunity?.totalCapacity ?? (initialFormType === "camp" ? "4" : "8")),
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
      if (!initialOpportunity) {
        setPrice("99");
      }

      if (!endDateTouched && startDate) {
        setEndDate(startDate);
      }
      return;
    }

    setBookingMode("approval_required");
    if (!initialOpportunity) {
      setPrice("550");
      setMinMinutesOrHours("60");
      setTotalCapacity("4");
      setStartDate(defaultCampStartDate);
      setEndDate(defaultCampEndDate);
      setEndDateTouched(false);
      return;
    }

    if (!endDateTouched && startDate) {
      setEndDate(addDays(startDate, 4));
    }
  }

  function updateStartDate(value: string) {
    setStartDate(value);
    if (type === "huck_jam") {
      setEndDate(value);
    } else if (!endDateTouched) {
      setEndDate(addDays(value, 4));
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

      if (type === "huck_jam") {
        if (!isValidTime(sessionStart) || !isValidTime(sessionEnd)) {
          return "Enter the Huck Jam start and end time.";
        }

        if (sessionEnd <= sessionStart) {
          return "End time must be after start time.";
        }
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
        bookingMode: "approval_required" as BookingMode,
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

      if (onSuccess) {
        onSuccess(result.data.id);
      } else {
        router.push(
          mode === "edit" && initialOpportunity
            ? `/app/organizer/opportunities/${initialOpportunity.id}`
            : `/app/organizer/opportunities/${result.data.id}?published=1`,
        );
      }
      router.refresh();
    });
  }

  return (
    <form
      className="mt-3 grid w-full gap-3 overflow-visible rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
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
            sessionStart={sessionStart}
            sessionEnd={sessionEnd}
            showLastMinuteNotice={showLastMinuteNotice}
            onStartDateChange={updateStartDate}
            onEndDateChange={(value) => {
              setEndDateTouched(true);
              setEndDate(value);
            }}
            onRegistrationDeadlineChange={setRegistrationDeadline}
            onSessionStartChange={setSessionStart}
            onSessionEndChange={setSessionEnd}
          />
        ) : null}

        {currentStep.id === "capacity" ? (
          <CapacityStep
            type={type}
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
            sessionStart={sessionStart}
            sessionEnd={sessionEnd}
            registrationDeadline={registrationDeadline}
            totalCapacity={totalCapacity}
            bookingMode={bookingMode}
            price={price}
            currency={currency}
            minMinutesOrHours={minMinutesOrHours}
            organizerName={organizerName}
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
          disabled={isPending || (!onCancel && stepIndex === 0)}
          onClick={() => {
            if (onCancel && stepIndex === 0) {
              onCancel();
              return;
            }

            goToStep(Math.max(stepIndex - 1, 0));
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:px-4"
        >
          {onCancel && stepIndex === 0 ? "Cancel" : "Back"}
        </button>
        <button
          type="submit"
          disabled={isPending || (currentStep.id === "pricing" && Boolean(priceAppliesToError))}
          className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300 sm:px-5"
        >
          {currentStep.id === "review"
            ? isPending
              ? mode === "edit"
                ? "Saving..."
                : `Creating ${flowName}...`
              : mode === "edit"
                ? "Save changes"
                : `Create ${flowName} 🚀`
            : "Continue →"}
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
    <nav aria-label="Create progress" className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
          Step {currentIndex + 1} of {steps.length}
        </p>
        <p className="text-xs font-bold text-slate-500">
          {steps[currentIndex]?.label}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-600 transition-all"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-7">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;
          const canSelect = index <= maxVisitedIndex;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!canSelect}
                onClick={() => onSelect(index)}
                className={`grid w-full min-w-0 gap-1 rounded-xl border px-2 py-2 text-left transition ${
                  isCurrent
                    ? "border-sky-300 bg-sky-50"
                    : isComplete
                      ? "border-emerald-200 bg-emerald-50"
                      : canSelect
                        ? "border-slate-200 bg-white hover:bg-sky-50"
                        : "border-slate-100 bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[0.68rem] font-black ${
                      isComplete
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                          ? "bg-sky-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isComplete ? <Check size={13} /> : index + 1}
                  </span>
                  <span
                    className={`truncate text-[0.68rem] font-black sm:text-xs ${
                      isCurrent
                        ? "text-sky-800"
                        : isComplete
                          ? "text-emerald-800"
                          : canSelect
                            ? "text-slate-700"
                            : "text-slate-300"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
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
          <span className="text-xs font-semibold leading-4 text-slate-500">
            This information will be visible to athletes.
          </span>
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
  sessionStart,
  sessionEnd,
  showLastMinuteNotice,
  onStartDateChange,
  onEndDateChange,
  onRegistrationDeadlineChange,
  onSessionStartChange,
  onSessionEndChange,
}: {
  type: OpportunityType;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  sessionStart: string;
  sessionEnd: string;
  showLastMinuteNotice: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRegistrationDeadlineChange: (value: string) => void;
  onSessionStartChange: (value: string) => void;
  onSessionEndChange: (value: string) => void;
}) {
  const isHuckJam = type === "huck_jam";
  const [deadlineMode, setDeadlineMode] = useState<"start" | "custom">(
    registrationDeadline ? "custom" : "start",
  );
  const startLabel = isHuckJam ? "When the event starts" : "When the camp starts";

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow={isHuckJam ? "Session" : "Schedule"}
        title={isHuckJam ? "Set the event date and time" : "Set the camp dates"}
        description="Set when this opportunity happens and when sign-up should close."
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
            : "grid min-w-0 gap-2.5 md:grid-cols-2"
        }
      >
        <Field label={isHuckJam ? "Event Date" : "Start Date"} required>
          <DateInput
            value={startDate}
            onChange={onStartDateChange}
          />
        </Field>
        {!isHuckJam ? (
          <Field label="End Date" required>
            <DateInput
              value={endDate}
              onChange={onEndDateChange}
            />
          </Field>
        ) : null}
      </div>
      {isHuckJam ? (
        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
          <Field label="Start Time" required>
            <input
              type="time"
              className={fieldClass}
              value={sessionStart}
              onChange={(event) => onSessionStartChange(event.target.value)}
            />
          </Field>
          <Field label="End Time" required>
            <input
              type="time"
              className={fieldClass}
              value={sessionEnd}
              onChange={(event) => onSessionEndChange(event.target.value)}
            />
          </Field>
        </div>
      ) : null}
      <div className="grid gap-2">
        <p className="text-sm font-black text-slate-800">Registration closes</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
              deadlineMode === "start"
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="registrationDeadlineMode"
              checked={deadlineMode === "start"}
              onChange={() => {
                setDeadlineMode("start");
                onRegistrationDeadlineChange("");
              }}
              className="size-4 accent-sky-600"
            />
            {startLabel}
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
              deadlineMode === "custom"
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="registrationDeadlineMode"
              checked={deadlineMode === "custom"}
              onChange={() => setDeadlineMode("custom")}
              className="size-4 accent-sky-600"
            />
            Custom date
          </label>
        </div>
        {deadlineMode === "custom" ? (
          <div className="max-w-xs">
            <Field label="Registration Deadline">
              <DateInput
                value={registrationDeadline}
                onChange={onRegistrationDeadlineChange}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="relative block w-full max-w-xs">
      <CalendarDays
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="date"
        className={dateFieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}

function CapacityStep({
  type,
  bookingMode,
  totalCapacity,
  onBookingModeChange,
  onCapacityChange,
}: {
  type: OpportunityType;
  bookingMode: BookingMode;
  totalCapacity: string;
  onBookingModeChange: (value: BookingMode) => void;
  onCapacityChange: (value: string) => void;
}) {
  const isCamp = type === "camp";

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Capacity"
        title="How should booking work?"
        description="Choose how athletes join, then set the maximum number of participants."
      />
      {isCamp ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm font-bold text-sky-800">
          Camps always use coach approval.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          <BookingModeOption
            value="approval_required"
            selectedValue={bookingMode}
            title="Coach approves participants"
            description="Recommended for Camps"
            onChange={onBookingModeChange}
          />
          <BookingModeOption
            value="direct_time_booking"
            selectedValue={bookingMode}
            title="Direct booking"
            description="Recommended for Huck Jams"
            onChange={onBookingModeChange}
          />
        </div>
      )}
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
        description="Set the amount athletes see for the flying-time duration."
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-black text-slate-800">Price</p>
        <div className="mt-2 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_auto_minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Amount
            <input
              type="text"
              inputMode="decimal"
              className={fieldClass}
              value={price}
              onChange={(event) => onPriceChange(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Currency
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
          </label>
          <span className="hidden pb-2 text-sm font-black text-slate-500 sm:block">
            for
          </span>
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Minutes
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
          </label>
          <span className="pb-2 text-sm font-black text-slate-500">minutes</span>
        </div>
        <span className="mt-2 block text-xs font-semibold leading-4 text-slate-500">
          Displayed as {formatCurrency(price || "0", currency)} per{" "}
          {minMinutesOrHours || "60"} minutes.
        </span>
        {priceAppliesToError ? (
          <span className="mt-1 block text-xs font-bold leading-5 text-rose-600">
            {priceAppliesToError}
          </span>
        ) : null}
      </div>
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
            type="text"
            inputMode="decimal"
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
  sessionStart,
  sessionEnd,
  registrationDeadline,
  totalCapacity,
  bookingMode,
  price,
  currency,
  minMinutesOrHours,
  organizerName,
  onEdit,
}: {
  type: OpportunityType;
  title: string;
  selectedTunnel?: TunnelOption;
  startDate: string;
  endDate: string;
  sessionStart: string;
  sessionEnd: string;
  registrationDeadline: string;
  totalCapacity: string;
  bookingMode: BookingMode;
  price: string;
  currency: string;
  minMinutesOrHours: string;
  organizerName?: string;
  onEdit: (stepId: StepId) => void;
}) {
  const isHuckJam = type === "huck_jam";
  const name = title.trim() || fallbackOpportunityName(type, organizerName);
  const tunnelLabel = selectedTunnel
    ? `${selectedTunnel.name}, ${selectedTunnel.city}`
    : "Tunnel not selected";
  const dateLabel = isHuckJam
    ? formatDate(startDate)
    : `${formatDate(startDate)} - ${formatDate(endDate)}`;
  const sessionLabel =
    isHuckJam && sessionStart && sessionEnd
      ? `${formatSessionTime(sessionStart)} - ${formatSessionTime(sessionEnd)}`
      : "";
  const bookingLabel =
    isHuckJam || bookingMode === "approval_required"
      ? "Approval Required"
      : "Direct Booking";
  const priceLabel = isHuckJam
    ? formatCurrency(price, currency)
    : `${formatCurrency(price, currency)} per ${minMinutesOrHours || "60"} minutes`;
  const deadlineLabel = registrationDeadline
    ? `Registration closes ${formatDate(registrationDeadline)}`
    : `Registration closes when the ${isHuckJam ? "event" : "camp"} starts`;

  return (
    <div className="grid gap-3">
      <StepHeader
        eyebrow="Review"
        title={`Ready to create this ${isHuckJam ? "Huck Jam" : "camp"}?`}
        description="Preview what athletes will see before publishing."
      />
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
          {isHuckJam ? "Huck Jam" : "Camp"}
        </p>
        <h3 className="mt-1 break-words text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          {name}
        </h3>
        <div className="mt-4 grid gap-2">
          <ReviewLine
            icon={<MapPin size={17} />}
            value={tunnelLabel}
            onEdit={() => onEdit("location")}
          />
          <ReviewLine
            icon={<CalendarDays size={17} />}
            value={sessionLabel ? `${dateLabel}, ${sessionLabel}` : dateLabel}
            onEdit={() => onEdit("schedule")}
          />
          <ReviewLine
            icon={<Users size={17} />}
            value={`${totalCapacity || "0"} Participants`}
            onEdit={() => onEdit(isHuckJam ? "participation" : "capacity")}
          />
          <ReviewLine
            icon={<ClipboardCheck size={17} />}
            value={bookingLabel}
            onEdit={() => onEdit(isHuckJam ? "participation" : "capacity")}
          />
          <ReviewLine
            icon={<CircleDollarSign size={17} />}
            value={priceLabel}
            onEdit={() => onEdit(isHuckJam ? "participation" : "pricing")}
          />
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          {deadlineLabel}
        </p>
      </section>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Edit details", stepId: "basics" as StepId },
          { label: "Edit schedule", stepId: "schedule" as StepId },
          {
            label: isHuckJam ? "Edit participation" : "Edit pricing",
            stepId: isHuckJam ? ("participation" as StepId) : ("pricing" as StepId),
          },
        ].map((item) => (
          <button
            type="button"
            key={item.stepId}
            onClick={() => onEdit(item.stepId)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-sky-50"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewLine({
  icon,
  value,
  onEdit,
}: {
  icon: ReactNode;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-2 text-left text-sm font-black text-slate-800 transition hover:bg-sky-50"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </button>
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
      <div className="relative z-20">
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
          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-left shadow-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-600 text-xs font-black text-white">
              <Check size={15} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-sky-950">
                {selectedTunnel.name}
              </span>
              <span className="block truncate text-xs font-semibold text-sky-700">
                {selectedTunnel.city}, {selectedTunnel.country}
              </span>
            </span>
          </div>
        ) : null}
        {isOpen ? (
          <div
            id="tunnel-options"
            role="listbox"
            className="absolute z-50 mt-1 max-h-[min(22rem,55vh)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
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
      className={`grid cursor-pointer gap-1.5 rounded-xl border px-3 py-3 text-sm transition ${
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
      <span className="pl-6 text-xs font-bold leading-4 text-slate-500">
        {description}
      </span>
    </label>
  );
}
