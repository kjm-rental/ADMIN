"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  LoaderCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize,
  X,
  Scan,
} from "lucide-react";
import { documentLabel } from "@/lib/verification-attestation";
import type { ReviewType } from "@/components/verification-decision-form";
export type DocumentReviewContext = {
  verificationId: string;
  bookingId: string;
  statuses: Record<ReviewType, string>;
  types: ReviewType[];
};
export type ReviewDocument = {
  id: string;
  document_kind: string;
  mime_type: string;
  status: string;
  created_at: string;
  size_bytes: number;
  replaced_at?: string | null;
};
export function PrivateDocumentViewer({
  documents,
  activeDocumentId,
  onDocumentSelect,
}: {
  documents: ReviewDocument[];
  review?: DocumentReviewContext;
  activeDocumentId?: string;
  onDocumentSelect?: (id: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const visible = documents.filter((d) => showHistory || !d.replaced_at);
  const selected =
    visible.find((d) => d.id === (activeDocumentId ?? selectedId)) ??
    visible[0];
  const index = visible.findIndex((d) => d.id === selected?.id);
  function select(id: string) {
    setSelectedId(id);
    onDocumentSelect?.(id);
    setZoom(1);
    setRotation(0);
  }
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label="Previous document"
        disabled={index <= 0}
        onClick={() => select(visible[index - 1].id)}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-xs text-slate-500">
        {index + 1} / {visible.length}
      </span>
      <button
        type="button"
        aria-label="Next document"
        disabled={index >= visible.length - 1}
        onClick={() => select(visible[index + 1].id)}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= 0.5}
        onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <ZoomOut size={18} />
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= 3}
        onClick={() => setZoom((v) => Math.min(3, v + 0.25))}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <ZoomIn size={18} />
      </button>
      <button
        type="button"
        aria-label="Rotate document"
        onClick={() => setRotation((v) => (v + 90) % 360)}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <RotateCcw size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setZoom(1);
          setRotation(0);
        }}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <Scan size={16} /> Fit
      </button>
      <button
        type="button"
        aria-label="Full-screen preview"
        onClick={() => {
          dialog.current?.showModal();
          if (surface.current) dialog.current?.appendChild(surface.current);
        }}
        className="admin-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-xs disabled:opacity-40"
      >
        <Maximize size={18} />
      </button>
    </div>
  );
  const host = useRef<HTMLDivElement>(null);
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Documents">
        {visible.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={selected?.id === d.id}
            onClick={() => select(d.id)}
            className={`min-h-11 border-b-2 px-3 py-2 text-left text-xs ${selected?.id === d.id ? "border-ocean text-deep-teal" : "border-transparent text-slate-500"}`}
          >
            <span className="block font-bold capitalize">
              {documentLabel(d.document_kind)}
            </span>
          </button>
        ))}
      </div>
      {documents.some((d) => d.replaced_at) && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />{" "}
          Show previous uploads
        </label>
      )}
      <div ref={host}>
        <div ref={surface} className="space-y-3 bg-white p-2">
          {selected ? (
            <>
              {controls}
              <div className="h-[65dvh] min-h-80 overflow-auto rounded-xl border bg-slate-100">
                <div
                  style={{
                    width: `${zoom * 100}%`,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: "center",
                  }}
                >
                  <DocumentPreview
                    key={selected.id}
                    document={selected}
                    large
                    scale={zoom}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="admin-note">No current documents uploaded.</p>
          )}
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-label="Full-screen document preview"
        onClose={() => {
          if (surface.current) host.current?.appendChild(surface.current);
        }}
        className="m-auto h-[95dvh] w-[96vw] max-w-none overflow-auto rounded-xl bg-white p-4 backdrop:bg-slate-900/70"
      >
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="admin-button-secondary mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3"
        >
          <X size={18} /> Close preview
        </button>
      </dialog>
    </div>
  );
}
function DocumentPreview({
  document,
  large = false,
  scale = 1,
}: {
  document: ReviewDocument;
  large?: boolean;
  scale?: number;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(() => setState("error"), 20000);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);
  function recover() {
    if (attempt < 2) {
      setState("loading");
      setAttempt((value) => value + 1);
    } else setState("error");
  }
  const source = `/dashboard/documents/${document.id}?preview=${attempt}`;
  const image = document.mime_type.startsWith("image/");
  return (
    <div
      className={`relative mt-3 overflow-hidden rounded-lg bg-slate-100 ${large ? "min-h-[65dvh]" : "h-44"}`}
    >
      {state === "loading" && (
        <p
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-100 text-sm text-slate-500"
        >
          <LoaderCircle className="size-5 animate-spin" />
          Loading private document…
        </p>
      )}
      {state === "error" ? (
        <div
          role="alert"
          className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-4 text-center text-sm"
        >
          <p>This document could not be loaded. Retry to renew private access. If it still fails, check your administrator session or whether the original file is available.</p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setAttempt((v) => v + 1);
            }}
            className="min-h-11 rounded-lg border px-4 font-bold"
          >
            Retry document
          </button>
        </div>
      ) : image ? (
        <Image
          key={source}
          src={source}
          alt={document.document_kind.replaceAll("_", " ")}
          unoptimized
          width={1200}
          height={900}
          onLoad={() => setState("loaded")}
          onError={recover}
          style={large ? { height: `calc(60dvh * ${scale})` } : undefined}
          className={`w-full object-contain ${large ? "h-[60dvh]" : "h-44"}`}
        />
      ) : (
        <iframe
          key={source}
          title={document.document_kind.replaceAll("_", " ")}
          src={source}
          onLoad={() => setState("loaded")}
          onError={recover}
          referrerPolicy="no-referrer"
          className={`w-full border-0 ${large ? "h-[70dvh]" : "h-44"}`}
        />
      )}
    </div>
  );
}
