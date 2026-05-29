import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
};

export function Section({ title, eyebrow, children }: SectionProps) {
  return (
    <section className="mt-8">
      {eyebrow ? (
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}
