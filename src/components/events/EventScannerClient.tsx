"use client";

import jsQR from "jsqr";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ClubEventNav,
  EventEmptyState,
  EventsFrame,
  EventsHeader,
  EventStatusPill,
  eventInput,
  eventPrimaryButton,
  eventSecondaryButton
} from "@/components/events/EventPrimitives";
import type { AdmissionPreview, AdmissionResultCode, ScannerAssignedEvent } from "@/lib/events/types";
import { useEventsI18n } from "@/lib/events/localization";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type RecentEntry = {
  id: string;
  checkedInAt: string;
  studentDisplayName: string;
  studentUsername: string | null;
  scannerDisplayName: string;
};

const admissionResultCodes = new Set<AdmissionResultCode>([
  "valid_ticket",
  "already_checked_in",
  "payment_pending",
  "payment_under_review",
  "reservation_expired",
  "ticket_rejected",
  "ticket_cancelled",
  "ticket_refunded",
  "no_ticket",
  "event_cancelled",
  "event_completed",
  "wrong_university",
  "invalid_qr",
  "unauthorized_scanner"
]);

function isAdmissionResultCode(value: unknown): value is AdmissionResultCode {
  return typeof value === "string" && admissionResultCodes.has(value as AdmissionResultCode);
}

function AdmissionCard({
  preview,
  onConfirm,
  confirming
}: {
  preview: AdmissionPreview;
  onConfirm?: () => void;
  confirming?: boolean;
}) {
  const { copy, formatDateTime } = useEventsI18n();
  const valid = preview.result === "valid_ticket";
  return (
    <div className={cn("rounded-2xl border-2 border-black p-4", valid ? "bg-[#ffd400]" : "bg-white")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {preview.student ? (
            preview.student.avatarUrl ? (
              <img
                src={preview.student.avatarUrl}
                alt={preview.student.displayName}
                className="h-14 w-14 shrink-0 rounded-full border-2 border-black bg-white object-cover"
              />
            ) : (
              <span className="material-symbols-outlined flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-[30px]" aria-hidden="true">person</span>
            )
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/50">{preview.eventTitle}</p>
            <h3 className="mt-1 break-words text-[20px] font-black">{preview.student?.displayName || "—"}</h3>
            {preview.student?.username ? <p className="text-[13px] text-black/60">@{preview.student.username}</p> : null}
            {preview.student?.universityName ? <p className="mt-1 text-[12px] font-bold text-black/55">{preview.student.universityName}</p> : null}
          </div>
        </div>
        <EventStatusPill status={preview.result} />
      </div>
      {preview.checkedInAt ? <p className="mt-3 text-[13px] font-bold">{copy.checkedInAt}: {formatDateTime(preview.checkedInAt)}</p> : null}
      {valid && preview.confirmationToken && onConfirm ? (
        <button type="button" className={cn(eventSecondaryButton, "mt-4 w-full")} onClick={onConfirm} disabled={confirming}>
          <span>{confirming ? copy.loading : copy.confirmEntry}</span>
        </button>
      ) : null}
    </div>
  );
}

export function EventScannerClient({ event }: { event: ScannerAssignedEvent }) {
  const { copy, errorLabel, formatDateTime } = useEventsI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const scanningRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualQr, setManualQr] = useState("");
  const [preview, setPreview] = useState<AdmissionPreview | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AdmissionPreview[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const loadRecent = useCallback(async () => {
    const response = await fetch(`/api/events/scanner/${encodeURIComponent(event.id)}/recent`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json().catch(() => ({})) as { scans?: RecentEntry[] };
    setRecent(payload.scans || []);
  }, [event.id]);

  useEffect(() => {
    const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    if (Detector) {
      try { detectorRef.current = new Detector({ formats: ["qr_code"] }); } catch { detectorRef.current = null; }
    }
    void loadRecent();
    const interval = window.setInterval(() => void loadRecent(), 15_000);
    return () => { window.clearInterval(interval); stopCamera(); };
  }, [loadRecent, stopCamera]);

  async function verifyQr(qr: string) {
    const value = qr.trim();
    if (!value || pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const response = await fetch(`/api/events/scanner/${encodeURIComponent(event.id)}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: value })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; preview?: AdmissionPreview };
      if (!response.ok || !payload.preview) throw new Error(payload.error || "scan_failed");
      setPreview(payload.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "scan_failed");
    } finally {
      setPending(false);
    }
  }

  async function scanFrame() {
    const video = videoRef.current;
    if (!scanningRef.current || !video) return;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      frameRef.current = requestAnimationFrame(() => void scanFrame());
      return;
    }
    try {
      let value: string | null = null;
      if (detectorRef.current) {
        const detected = await detectorRef.current.detect(video);
        value = detected[0]?.rawValue || null;
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          value = jsQR(image.data, image.width, image.height)?.data || null;
        }
      }
      if (value) {
        stopCamera();
        setManualQr(value);
        await verifyQr(value);
        return;
      }
    } catch {
      detectorRef.current = null;
    }
    if (scanningRef.current) frameRef.current = requestAnimationFrame(() => void scanFrame());
  }

  async function startCamera() {
    setError(null);
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("camera_unavailable");
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();
      scanningRef.current = true;
      setCameraActive(true);
      frameRef.current = requestAnimationFrame(() => void scanFrame());
    } catch {
      stopCamera();
      setError("scan_failed");
    }
  }

  async function confirmEntry(target: AdmissionPreview | null = preview) {
    if (!target?.confirmationToken) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/scanner/${encodeURIComponent(event.id)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewToken: target.confirmationToken })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; result?: string; checkedInAt?: string };
      if (!response.ok) throw new Error(payload.error || "admission_unavailable");
      if (payload.result === "entry_confirmed") {
        setMessage(copy.entryConfirmed);
        setPreview(null);
        setSearchResults((current) => current.filter((item) => item.ticketId !== target.ticketId));
        setManualQr("");
      } else if (isAdmissionResultCode(payload.result)) {
        const currentOutcome: AdmissionPreview = {
          ...target,
          result: payload.result,
          confirmationToken: null,
          checkedInAt: payload.checkedInAt || target.checkedInAt
        };
        setMessage(null);
        setPreview(currentOutcome);
        setSearchResults((current) => current.map((item) => item.ticketId === target.ticketId ? currentOutcome : item));
      } else {
        throw new Error("admission_unavailable");
      }
      await loadRecent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "admission_unavailable");
    } finally {
      setPending(false);
    }
  }

  async function searchAttendees(eventValue: React.FormEvent<HTMLFormElement>) {
    eventValue.preventDefault();
    const query = search.trim();
    if (query.length < 2) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/scanner/${encodeURIComponent(event.id)}/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { error?: string; attendees?: AdmissionPreview[] };
      if (!response.ok) throw new Error(payload.error || "search_unavailable");
      setSearchResults(payload.attendees || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "search_unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <EventsFrame>
      <ClubEventNav current="scanner" visible={["scanner"]} />
      <EventsHeader
        eyebrow={event.clubName}
        title={event.title}
        description={`${formatDateTime(event.startAt)} · ${event.location}`}
        action={<Link href="/app/club/scanner" className={eventSecondaryButton}><span>{copy.scannerEvents}</span></Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border-2 border-black bg-black text-white">
            <div className="flex items-center justify-between gap-3 p-4"><h2 className="text-[18px] font-black">{copy.cameraScanner}</h2><span className="rounded-full bg-[#ffd400] px-2.5 py-1 text-[12px] font-black text-black">{event.checkedInCount}/{event.approvedCount}</span></div>
            <div className="relative aspect-[4/3] bg-black sm:aspect-video">
              <video ref={videoRef} muted className="h-full w-full object-cover" />
              {!cameraActive ? <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"><span className="material-symbols-outlined text-[56px] text-[#ffd400]" aria-hidden="true">qr_code_scanner</span><p className="mt-3 max-w-sm text-[13px] leading-5 text-white/70">{copy.cameraUnavailable}</p></div> : <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-[#ffd400] shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />}
            </div>
            <div className="p-4"><button type="button" className={cn(eventPrimaryButton, "w-full")} onClick={cameraActive ? stopCamera : () => void startCamera()}><span>{cameraActive ? copy.stopCamera : copy.startCamera}</span></button></div>
          </section>

          <section className="rounded-2xl border-2 border-black bg-white p-4">
            <h2 className="text-[18px] font-black">{copy.manualQr}</h2>
            <form onSubmit={(e) => { e.preventDefault(); void verifyQr(manualQr); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={manualQr} onChange={(e) => setManualQr(e.target.value)} maxLength={1024} className={eventInput} placeholder={copy.manualQr} />
              <button type="submit" className={eventPrimaryButton} disabled={pending}><span>{copy.scan}</span></button>
            </form>
          </section>

          {message ? <p className="rounded-xl border-2 border-black bg-[#ffd400] p-3 text-[14px] font-black" role="status">{message}</p> : null}
          {error ? <p className="rounded-xl bg-black p-3 text-[14px] font-bold text-white" role="alert">{errorLabel(error)}</p> : null}
          {preview ? <AdmissionCard preview={preview} onConfirm={() => void confirmEntry(preview)} confirming={pending} /> : null}

          <section className="rounded-2xl border-2 border-black bg-white p-4">
            <h2 className="text-[18px] font-black">{copy.attendeeSearch}</h2>
            <form onSubmit={searchAttendees} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={(e) => setSearch(e.target.value)} minLength={2} maxLength={80} className={eventInput} placeholder={copy.searchByName} />
              <button type="submit" className={eventSecondaryButton} disabled={pending}><span>{copy.search}</span></button>
            </form>
            {searchResults.length ? <div className="mt-4 space-y-3">{searchResults.map((result) => <AdmissionCard key={`${result.student?.id || "unknown"}-${result.ticketId || "none"}`} preview={result} onConfirm={() => void confirmEntry(result)} confirming={pending} />)}</div> : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#ffd400]">
            <h2 className="text-[18px] font-black">{copy.recentEntries}</h2>
            {recent.length ? <div className="mt-3 divide-y divide-black/10">{recent.map((entry) => (
              <div key={entry.id} className="py-3"><p className="text-[14px] font-black">{entry.studentDisplayName}</p>{entry.studentUsername ? <p className="text-[12px] text-black/55">@{entry.studentUsername}</p> : null}<p className="mt-1 text-[11px] font-bold text-black/50">{formatDateTime(entry.checkedInAt)} · {copy.scannedBy} {entry.scannerDisplayName}</p></div>
            ))}</div> : <EventEmptyState text={copy.noRecentEntries} />}
          </div>
        </aside>
      </div>
    </EventsFrame>
  );
}
