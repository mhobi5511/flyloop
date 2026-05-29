import { AppShell } from "@/components/AppShell";
import { CreateOpportunityForm } from "@/components/CreateOpportunityForm";

export default function CreateOpportunityPage() {
  return (
    <AppShell active="create">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Post opportunity</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Publish a camp or Huck Jam with just enough detail for athletes to
          discover it and send interest.
        </p>
        <CreateOpportunityForm />
      </div>
    </AppShell>
  );
}
