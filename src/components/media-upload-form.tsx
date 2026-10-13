"use client";
import { ActionForm } from "@/components/action-form";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { uploadMedia } from "@/app/actions/fleet";
import { SubmitButton } from "@/components/submit-button";

export function MediaUploadForm({ modelId }: { modelId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews],
  );
  function select(list: FileList | null) {
    setFiles(Array.from(list ?? []).slice(0, 12));
  }
  return (
    <ActionForm
      action={uploadMedia}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="modelId" value={modelId} />
      <div>
        <h3 className="font-extrabold text-deep-teal">Upload photos</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Business-owned or commercially authorized images only.
        </p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          select(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-ocean bg-ocean/5" : "border-slate-200 bg-slate-50"}`}
      >
        <ImagePlus className="mx-auto size-7 text-ocean" />
        <p className="mt-3 text-sm font-bold text-deep-teal">
          Drag photos here
        </p>
        <p className="mt-1 text-xs text-slate-400">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-sm font-bold text-ocean underline underline-offset-4"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          required={!files.length}
          multiple
          name="files"
          aria-label="Select motorcycle catalog photos"
          type="file"
          accept="image/avif,image/webp,image/jpeg,image/png"
          onChange={(e) => select(e.target.files)}
          className="sr-only"
        />
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {previews.map(({ file, url }, index) => (
            <div key={`${file.name}-${index}`} className="relative">
              <Image
                src={url}
                alt="Selected upload preview"
                width={240}
                height={160}
                unoptimized
                className="h-24 w-full rounded-xl bg-slate-50 object-contain p-2"
              />
              <button
                type="button"
                onClick={() =>
                  setFiles((items) => items.filter((_, i) => i !== index))
                }
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 rounded-full bg-deep-teal p-1 text-white"
              >
                <X className="size-3" />
              </button>
              <p className="truncate px-1 text-[10px] text-slate-400">
                {file.name}
              </p>
            </div>
          ))}
        </div>
      )}
      <label className="block text-sm font-bold text-deep-teal">
        Descriptive alt text
        <input
          required
          minLength={5}
          name="alt"
          placeholder="Full motorcycle on a clean background"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-ocean focus:ring-3 focus:ring-ocean/10"
        />
      </label>
      <label className="flex gap-2 text-sm text-slate-600">
        <input
          name="setPrimary"
          type="checkbox"
          defaultChecked
          className="accent-ocean"
        />
        Use the first selected photo as primary
      </label>
      <input type="hidden" name="primaryIndex" value="0" />
      <p className="text-xs leading-5 text-slate-400">
        Up to 12 AVIF, WebP, JPEG, or PNG files. Maximum 8 MB each. Upload
        progress is shown while the form is submitting.
      </p>
      <SubmitButton pendingLabel="Uploading photos…" className="w-full">
        Upload approved photos
      </SubmitButton>
    </ActionForm>
  );
}
