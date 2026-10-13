"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, ZoomIn, ZoomOut, X, RotateCcw } from "lucide-react";
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
}: {
  documents: ReviewDocument[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<ReviewDocument | null>(null);
  const [zoom, setZoom] = useState(1);
  function open(document: ReviewDocument, button: HTMLButtonElement) {
    opener.current = button;
    setSelected(document);
    setZoom(1);
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    opener.current?.focus();
  }
  return (
    <>
      {!documents.length && (
        <p className="admin-note">
          No private documents uploaded for this booking.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {documents.map((document) => (
          <article
            key={document.id}
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
          >
            <h3 className="text-sm font-extrabold capitalize text-deep-teal">
              {document.document_kind.replaceAll("_", " ")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {document.replaced_at
                ? "Superseded — retained audit evidence"
                : document.status.replaceAll("_", " ")}{" "}
              · {(document.size_bytes / 1024).toFixed(0)} KB
            </p>
            <DocumentPreview document={document} />
            <button
              type="button"
              onClick={(event) => open(document, event.currentTarget)}
              className="mt-3 min-h-11 rounded-lg border border-ocean px-4 text-sm font-bold text-ocean"
            >
              Enlarge {document.document_kind.replaceAll("_", " ")}
            </button>
          </article>
        ))}
      </div>
      <dialog
        ref={dialog}
        onCancel={() => opener.current?.focus()}
        aria-labelledby="private-document-title"
        className="m-auto h-[min(90dvh,60rem)] w-[min(95vw,80rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 backdrop:bg-deep-teal/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="private-document-title"
            className="font-bold capitalize text-deep-teal"
          >
            {selected?.document_kind.replaceAll("_", " ")}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => setZoom((v) => Math.max(1, v - 0.25))}
              className="grid size-11 place-items-center rounded-lg border disabled:opacity-40"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => setZoom(1)}
              className="flex h-11 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <RotateCcw size={16} />
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 3}
              onClick={() => setZoom((v) => Math.min(3, v + 0.25))}
              className="grid size-11 place-items-center rounded-lg border disabled:opacity-40"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              aria-label="Close document viewer"
              onClick={close}
              className="grid size-11 place-items-center rounded-lg border"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="mt-4 h-[calc(100%-5rem)] overflow-auto rounded-xl bg-slate-100">
          {selected && (
            <div style={{ width: `${zoom * 100}%`, minHeight: "100%" }}>
              <DocumentPreview key={selected.id} document={selected} large />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
function DocumentPreview({
  document,
  large = false,
}: {
  document: ReviewDocument;
  large?: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const source = `/dashboard/documents/${document.id}?preview=${attempt}`;
  const image = document.mime_type.startsWith("image/");
  return (
    <div
      className={`relative mt-3 overflow-hidden rounded-lg bg-slate-100 ${large ? "min-h-[65dvh]" : "h-60"}`}
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
          <p>Unable to display this private document.</p>
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
          onError={() => setState("error")}
          className={`w-full object-contain ${large ? "h-auto min-h-[65dvh]" : "h-60"}`}
        />
      ) : (
        <iframe
          key={source}
          title={document.document_kind.replaceAll("_", " ")}
          src={source}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          referrerPolicy="no-referrer"
          className={`w-full border-0 ${large ? "h-[70dvh]" : "h-60"}`}
        />
      )}
    </div>
  );
}
