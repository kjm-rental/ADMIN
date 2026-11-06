"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Play,
  Search,
} from "lucide-react";
import { guideGroups, ownerGuideTopics } from "@/lib/owner-guide/topics";
export function OwnerGuide() {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("all");
  useEffect(() => {
    const reveal = () => {
      let id = "";
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      } else if (ownerGuideTopics.some((topic) => topic.id === id)) {
        setQuery("");
        setGroup("all");
        requestAnimationFrame(() => {
          const topic = document.getElementById(id);
          if (topic instanceof HTMLDetailsElement) {
            topic.open = true;
            topic.scrollIntoView({ block: "start" });
          }
        });
      }
    };
    const timer = setTimeout(reveal, 0);
    window.addEventListener("hashchange", reveal);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", reveal);
    };
  }, []);
  const needle = query.trim().toLowerCase();
  const topics = ownerGuideTopics.filter(
    (topic) =>
      (group === "all" || topic.group === group) &&
      (!needle ||
        [
          topic.title,
          topic.summary,
          ...topic.steps,
          ...(topic.notes ?? []),
          ...(topic.glossary ?? []).flatMap((item) => [
            item.label,
            item.meaning,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );
  return (
    <div className="owner-guide-page">
      <header className="owner-guide-hero">
        <div>
          <span className="owner-guide-eyebrow">KJM owner’s handbook</span>
          <h1>
            A little guidance.
            <br />A smoother day.
          </h1>
          <p>
            Every section explained, with practical steps for bookings, the
            bikes, the money and everything in between.
          </p>
          <button
            type="button"
            className="owner-guide-primary"
            onClick={() => {
              document.documentElement.dataset.ownerGuideRequested = "true";
              window.dispatchEvent(new Event("kjm:open-owner-tour"));
            }}
          >
            <Play size={16} />
            Start or resume the walkthrough
          </button>
        </div>
        <div className="owner-guide-hero-note">
          <BookOpen size={28} />
          <strong>Help, whenever you need it.</strong>
          <span>
            Read at your own pace. Opening the guide changes no booking, payment
            or setting.
          </span>
          <Link href="#daily-checklist">
            Jump to the daily checklist <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <section className="owner-guide-route" aria-label="The rental workflow">
        <span>A rental, from start to finish</span>
        <ol>
          {[
            "Review booking",
            "Verify documents",
            "Payment & deposit",
            "Handover",
            "Return & close",
          ].map((item, index) => (
            <li key={item}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              {item}
            </li>
          ))}
        </ol>
      </section>
      <div className="owner-guide-tools">
        <label className="owner-guide-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search the owner guide"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: expired, refund, ID deposit, contract…"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </label>
        <nav className="owner-guide-categories" aria-label="Guide categories">
          <button
            type="button"
            aria-pressed={group === "all"}
            onClick={() => setGroup("all")}
          >
            Everything
          </button>
          {guideGroups.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={group === item}
              onClick={() => setGroup(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <p role="status" className="owner-guide-result-count">
        {topics.length} {topics.length === 1 ? "topic" : "topics"}
        {needle
          ? ` matching “${query.trim()}”`
          : " · Open a topic for the steps"}
      </p>
      {topics.length === 0 && (
        <div className="owner-guide-empty">
          <Search size={26} />
          <h2>No matching topics</h2>
          <p>Try a shorter phrase, or show all categories.</p>
          <button
            type="button"
            className="owner-guide-secondary"
            onClick={() => {
              setQuery("");
              setGroup("all");
            }}
          >
            Show the full guide
          </button>
        </div>
      )}
      <div className="owner-guide-topics">
        {topics.map((topic) => (
          <details
            id={topic.id}
            key={topic.id}
            open={needle ? true : undefined}
            className="owner-guide-topic"
          >
            <summary>
              <span>
                <small>{topic.group}</small>
                <strong>{topic.title}</strong>
                <span>{topic.summary}</span>
              </span>
              <ChevronDown size={20} />
            </summary>
            <div className="owner-guide-topic-body">
              <ol>
                {topic.steps.map((step, index) => (
                  <li key={step}>
                    <b aria-hidden="true">{index + 1}</b>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
              {topic.glossary && (
                <dl className="owner-guide-glossary">
                  {topic.glossary.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.meaning}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {topic.notes && (
                <div className="owner-guide-notes">
                  {topic.notes.map((note) => (
                    <p key={note}>
                      <Check size={15} aria-hidden="true" />
                      <span>{note}</span>
                    </p>
                  ))}
                </div>
              )}
              <Link href={topic.href} className="owner-guide-open">
                {topic.linkLabel}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </details>
        ))}
      </div>
      <footer className="owner-guide-footer">
        Still unsure? Open the booking’s <strong>Next step</strong> and{" "}
        <strong>Rental readiness</strong> sections to see the specific checks
        needed for that rental.
      </footer>
    </div>
  );
}
