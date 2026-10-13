import Link from "next/link";
import { ModelForm } from "@/components/model-form";
export default function NewModelPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/fleet" className="text-ocean text-sm font-bold">
        ← Fleet
      </Link>
      <p className="mt-6 text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
        Fleet Management
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-deep-teal">
        Add motorcycle model
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Complete the catalog information, then save as a draft or publish when
        ready.
      </p>
      <div className="mt-7">
        <ModelForm />
      </div>
    </div>
  );
}
