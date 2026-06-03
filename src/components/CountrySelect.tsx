"use client";

import { useMemo, useRef, useState } from "react";
import { mobileCountryCodeOptions } from "@/lib/phone";

type CountrySelectProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export const countryOptions = Array.from(
  new Set(mobileCountryCodeOptions.map((option) => option.country)),
);

export function CountrySelect({
  id,
  label = "Country",
  value,
  onChange,
  required = false,
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id ?? "country"}-options`;
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return countryOptions;
    }

    return countryOptions.filter((countryName) =>
      countryName.toLowerCase().includes(query),
    );
  }, [search]);

  function openPicker() {
    setIsOpen(true);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function closePicker() {
    setSearch("");
    setIsOpen(false);
  }

  function selectCountry(countryName: string) {
    onChange(countryName);
    closePicker();
  }

  return (
    <div className="grid min-w-0 gap-1.5 text-sm font-bold text-slate-700">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          className="field flex items-center justify-between gap-2 text-left"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          <span className={value ? "truncate text-slate-900" : "text-slate-400"}>
            {value || "Select country"}
          </span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">
            v
          </span>
        </button>
        {isOpen ? (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                  closePicker();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  closePicker();
                }

                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  selectCountry(matches[0]);
                }
              }}
              className="field"
              placeholder="Search country"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              autoComplete="off"
            />
            <div
              id={listboxId}
              role="listbox"
              className="mt-2 max-h-72 overflow-y-auto rounded-lg"
            >
              {matches.length > 0 ? (
                matches.map((countryName) => (
                  <button
                    key={countryName}
                    type="button"
                    role="option"
                    aria-selected={value === countryName}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${
                      value === countryName
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountry(countryName)}
                  >
                    {countryName}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-semibold text-slate-500">
                  No country matches.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function normalizeCountrySelection(country?: string | null) {
  const value = country?.trim();

  if (!value) {
    return "";
  }

  return countryOptions.some((option) => option === value) ? value : "";
}
