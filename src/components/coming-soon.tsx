import { Clock3 } from "lucide-react";
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
        KJM administration
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-deep-teal">
        {title}
      </h1>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-sand text-deep-teal">
          <Clock3 className="size-5" />
        </span>
        <h2 className="mt-6 text-xl font-extrabold text-deep-teal">
          Coming in a future approved phase
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
          {description}
        </p>
        <p className="mt-5 text-xs font-semibold text-slate-400">
          No placeholder records or fabricated operational data are displayed.
        </p>
      </section>
    </div>
  );
}
