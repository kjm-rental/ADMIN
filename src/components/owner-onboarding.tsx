"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  HelpCircle,
  Play,
  X,
} from "lucide-react";
import {
  OWNER_TOUR_VERSION,
  ownerTourSteps,
  ownerTourStorageKey,
  parseOwnerTourProgress,
  type OwnerTourProgress,
} from "@/lib/owner-guide/tour";
export default function OwnerOnboarding({ ownerId }: { ownerId: string }) {
  const router = useRouter(),
    pathname = usePathname(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<"welcome" | "tour" | "complete" | null>(
      null,
    ),
    [index, setIndex] = useState(0),
    [completed, setCompleted] = useState(false);
  const key = ownerTourStorageKey(ownerId);
  function read() {
    try {
      return parseOwnerTourProgress(localStorage.getItem(key));
    } catch {
      return parseOwnerTourProgress(null);
    }
  }
  function save(progress: OwnerTourProgress) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: OWNER_TOUR_VERSION, ...progress }),
      );
    } catch {
      /* Help remains usable when browser storage is unavailable. */
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      let p: OwnerTourProgress;
      try {
        p = parseOwnerTourProgress(localStorage.getItem(key));
      } catch {
        p = parseOwnerTourProgress(null);
      }
      setIndex(p.step);
      setCompleted(p.completed);
      if (
        !p.seen &&
        pathname !== "/dashboard/help" &&
        !document.querySelector("dialog[open]")
      ) {
        try {
          localStorage.setItem(
            key,
            JSON.stringify({
              version: OWNER_TOUR_VERSION,
              seen: true,
              step: 0,
              completed: false,
            }),
          );
        } catch {}
        setView("welcome");
      }
    }, 0);
    const launch = () => {
      setView("welcome");
    };
    window.addEventListener("kjm:open-owner-tour", launch);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("kjm:open-owner-tour", launch);
    };
  }, [key, pathname]);
  useEffect(() => {
    if (view && !dialog.current?.open) dialog.current?.showModal();
    else if (!view && dialog.current?.open) dialog.current.close();
  }, [view]);
  useEffect(() => {
    if (view) heading.current?.focus();
  }, [view, index]);
  function close() {
    save({ seen: true, step: index, completed });
    setView(null);
    trigger.current?.focus();
  }
  function go(next: number) {
    setIndex(next);
    setCompleted(false);
    save({ seen: true, step: next, completed: false });
    setView("tour");
    const href = ownerTourSteps[next].href;
    if (window.location.pathname + window.location.search !== href)
      router.push(href);
  }
  function finish() {
    save({ seen: true, step: 0, completed: true });
    setCompleted(true);
    setIndex(0);
    setView("complete");
  }
  const step = ownerTourSteps[index];
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="owner-help-trigger"
        aria-label="Dashboard help and tutorial"
        aria-haspopup="dialog"
        aria-expanded={Boolean(view)}
        aria-controls="owner-dashboard-tour"
        onClick={() => {
          const p = read();
          setIndex(p.step);
          setCompleted(p.completed);
          save({ ...p, seen: true });
          setView("welcome");
        }}
      >
        <HelpCircle size={17} aria-hidden="true" />
        <span>Help</span>
      </button>
      <dialog
        id="owner-dashboard-tour"
        ref={dialog}
        className="owner-tour-dialog"
        aria-labelledby="owner-tour-heading"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => setView(null)}
      >
        <div className="owner-tour-top">
          <span className="owner-tour-brand">
            KJM. <span>OWNER’S GUIDE</span>
          </span>
          <button
            type="button"
            className="owner-guide-close"
            aria-label="Close tutorial"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        {view === "welcome" && (
          <div className="owner-tour-body">
            <span className="owner-tour-icon">
              <Compass size={27} />
            </span>
            <p className="owner-guide-eyebrow">A confident start</p>
            <h2 ref={heading} tabIndex={-1} id="owner-tour-heading">
              Your dashboard,
              <br />
              explained.
            </h2>
            <p className="owner-tour-intro">
              Learn where everything lives and how to manage a rental from the
              first booking to the final return.
            </p>
            <div className="owner-tour-preview">
              <span>Bookings & document checks</span>
              <span>Payments & deposits</span>
              <span>Pickup & return</span>
              <span>Fleet & business settings</span>
            </div>
            <p className="owner-tour-note">
              {ownerTourSteps.length} short stops. Pause anytime. This is a
              view-only walkthrough; save any unsaved edits before starting.
            </p>
            <button
              type="button"
              className="owner-guide-primary"
              onClick={() => go(completed ? 0 : index)}
            >
              <Play size={16} />
              {!completed && index > 0
                ? "Continue walkthrough"
                : "Start walkthrough"}
              <ArrowRight size={16} />
            </button>
            {!completed && index > 0 && (
              <button
                type="button"
                className="owner-guide-text-button"
                onClick={() => go(0)}
              >
                Start again from the beginning
              </button>
            )}
            <Link
              href="/dashboard/help"
              className="owner-guide-secondary"
              onClick={close}
            >
              <BookOpen size={16} />
              Read the full owner guide
            </Link>
            <button
              type="button"
              className="owner-guide-text-button"
              onClick={close}
            >
              Not now — I can reopen Help anytime
            </button>
          </div>
        )}
        {view === "tour" && (
          <div className="owner-tour-body">
            <div className="owner-tour-progress">
              <span>
                Step {index + 1} of {ownerTourSteps.length}
              </span>
              <span>
                {Math.round(((index + 1) / ownerTourSteps.length) * 100)}%
              </span>
            </div>
            <progress
              value={index + 1}
              max={ownerTourSteps.length}
              aria-label="Walkthrough progress"
            />
            <h2 ref={heading} tabIndex={-1} id="owner-tour-heading">
              {step.title}
            </h2>
            <p className="owner-tour-intro">{step.summary}</p>
            <ol className="owner-tour-points">
              {step.points.map((point, i) => (
                <li key={point}>
                  <span aria-hidden="true">{i + 1}</span>
                  <p>{point}</p>
                </li>
              ))}
            </ol>
            <Link
              href={`/dashboard/help#${step.topic}`}
              className="owner-guide-related"
              onClick={close}
            >
              <BookOpen size={15} />
              Full instructions for this topic <ArrowRight size={14} />
            </Link>
            <div className="owner-tour-controls">
              <button
                type="button"
                className="owner-guide-secondary"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="button"
                className="owner-guide-primary"
                onClick={() =>
                  index === ownerTourSteps.length - 1 ? finish() : go(index + 1)
                }
              >
                {index === ownerTourSteps.length - 1
                  ? "Finish walkthrough"
                  : "Next"}
                <ArrowRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className="owner-guide-text-button"
              onClick={close}
            >
              Pause — save my place
            </button>
          </div>
        )}
        {view === "complete" && (
          <div className="owner-tour-body">
            <span className="owner-tour-icon">
              <CheckCircle2 size={30} />
            </span>
            <p className="owner-guide-eyebrow">Ready for the day</p>
            <h2 ref={heading} tabIndex={-1} id="owner-tour-heading">
              You’ve got the map.
            </h2>
            <p className="owner-tour-intro">
              Use Overview for today’s work and keep the owner guide nearby
              whenever you need a reminder.
            </p>
            <Link
              href="/dashboard/help#daily-checklist"
              onClick={close}
              className="owner-guide-primary"
            >
              Open the daily checklist
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              className="owner-guide-secondary"
              onClick={() => {
                close();
                router.push("/dashboard");
              }}
            >
              Back to Overview
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
