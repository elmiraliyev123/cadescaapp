"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { ExploreSearchResponse, ExploreSearchResult } from "@/lib/search/types";
import { useLanguage, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SEARCH_COPY: Record<Language, {
  label: string;
  placeholder: string;
  hint: string;
  searching: string;
  empty: string;
  error: string;
  retry: string;
  clear: string;
  types: Record<ExploreSearchResult["type"], string>;
}> = {
  en: {
    label: "Search Cadesca",
    placeholder: "Search people, posts, clubs and events",
    hint: "Enter at least 2 characters",
    searching: "Searching Cadesca…",
    empty: "No matching people, posts, clubs or events.",
    error: "Search is unavailable right now.",
    retry: "Retry",
    clear: "Clear search",
    types: { person: "Person", post: "Post", club: "Club", event: "Event" }
  },
  az: {
    label: "Cadesca-da axtar",
    placeholder: "İnsan, paylaşım, klub və tədbir axtar",
    hint: "Ən azı 2 simvol daxil edin",
    searching: "Cadesca-da axtarılır…",
    empty: "Uyğun insan, paylaşım, klub və ya tədbir tapılmadı.",
    error: "Axtarış hazırda əlçatan deyil.",
    retry: "Yenidən cəhd et",
    clear: "Axtarışı təmizlə",
    types: { person: "Şəxs", post: "Paylaşım", club: "Klub", event: "Tədbir" }
  },
  tr: {
    label: "Cadesca'da ara",
    placeholder: "Kişi, gönderi, kulüp ve etkinlik ara",
    hint: "En az 2 karakter girin",
    searching: "Cadesca'da aranıyor…",
    empty: "Eşleşen kişi, gönderi, kulüp veya etkinlik yok.",
    error: "Arama şu anda kullanılamıyor.",
    retry: "Tekrar dene",
    clear: "Aramayı temizle",
    types: { person: "Kişi", post: "Gönderi", club: "Kulüp", event: "Etkinlik" }
  },
  ru: {
    label: "Поиск в Cadesca",
    placeholder: "Люди, публикации, клубы и события",
    hint: "Введите не менее 2 символов",
    searching: "Поиск в Cadesca…",
    empty: "Подходящих людей, публикаций, клубов или событий нет.",
    error: "Поиск сейчас недоступен.",
    retry: "Повторить",
    clear: "Очистить поиск",
    types: { person: "Человек", post: "Публикация", club: "Клуб", event: "Событие" }
  }
};

const ICONS: Record<ExploreSearchResult["type"], string> = {
  person: "person",
  post: "article",
  club: "groups",
  event: "event"
};

function SearchResultRow({ result, typeLabel }: { result: ExploreSearchResult; typeLabel: string }) {
  return (
    <Link
      href={result.href}
      role="option"
      className="flex min-h-[72px] min-w-0 items-center gap-3 border-b border-black/10 px-3 py-3 transition-colors last:border-b-0 hover:bg-[#fff8d6] focus-visible:bg-[#fff8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/15 bg-[#ffd400] text-black">
        {result.imageUrl ? (
          <img src={result.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined icon-ui" aria-hidden="true">{ICONS[result.type]}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-[15px] font-semibold leading-5 text-black">{result.title}</strong>
          <span className="shrink-0 rounded-full border border-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-black/60">
            {typeLabel}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-[13px] leading-5 text-black/60">{result.subtitle}</span>
      </span>
      <span className="material-symbols-outlined icon-inline shrink-0 text-black/45" aria-hidden="true">arrow_forward</span>
    </Link>
  );
}

export function ExploreSearch() {
  const { language } = useLanguage();
  const copy = SEARCH_COPY[language];
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [results, setResults] = useState<ExploreSearchResult[]>([]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setStatus("idle");
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      void fetch(`/api/explore/search?q=${encodeURIComponent(normalized)}`, {
        cache: "no-store",
        signal: controller.signal
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({})) as Partial<ExploreSearchResponse>;
          if (!response.ok || !Array.isArray(payload.results)) throw new Error("search_failed");
          setResults(payload.results);
          setStatus("success");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setStatus("error");
        });
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, retryKey]);

  function clear() {
    setQuery("");
    setResults([]);
    setStatus("idle");
    inputRef.current?.focus();
  }

  return (
    <section className="relative z-20" aria-label={copy.label}>
      <label htmlFor={inputId} className="mb-2 block text-[12px] font-bold uppercase tracking-[0.08em] text-secondary">
        {copy.label}
      </label>
      <div className={cn(
        "relative flex min-h-14 items-center rounded-2xl border-2 bg-white shadow-[3px_3px_0_#ffd400] transition-shadow",
        status === "error" ? "border-red-700" : "border-black focus-within:shadow-[5px_5px_0_#ffd400]"
      )}>
        <span className="material-symbols-outlined icon-action pointer-events-none ml-4 shrink-0 text-black" aria-hidden="true">search</span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              clear();
            }
          }}
          placeholder={copy.placeholder}
          aria-controls={`${inputId}-results`}
          aria-expanded={query.trim().length >= 2}
          aria-busy={status === "loading"}
          className="h-14 min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] font-medium text-black outline-none placeholder:text-black/45"
        />
        {query ? (
          <button type="button" onClick={clear} className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-black/60 hover:bg-black/5" aria-label={copy.clear}>
            <span className="material-symbols-outlined icon-ui" aria-hidden="true">close</span>
          </button>
        ) : null}
      </div>

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-2 text-[12px] text-secondary">{copy.hint}</p>
      ) : null}

      {query.trim().length >= 2 ? (
        <div id={`${inputId}-results`} role="listbox" className="mt-3 overflow-hidden rounded-2xl border border-black/15 bg-white shadow-lg">
          {status === "loading" ? (
            <div className="flex min-h-24 items-center justify-center gap-2 px-4 text-[14px] font-medium text-black/60" role="status">
              <span className="material-symbols-outlined icon-ui animate-spin" aria-hidden="true">progress_activity</span>
              {copy.searching}
            </div>
          ) : null}
          {status === "success" && !results.length ? (
            <div className="px-5 py-8 text-center text-[14px] leading-6 text-black/60">{copy.empty}</div>
          ) : null}
          {status === "error" ? (
            <div className="px-5 py-6 text-center" role="alert">
              <p className="text-[14px] text-black/65">{copy.error}</p>
              <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-3 min-h-11 rounded-xl bg-black px-4 text-[13px] font-bold text-white">
                {copy.retry}
              </button>
            </div>
          ) : null}
          {status === "success" ? results.map((result) => (
            <SearchResultRow key={`${result.type}:${result.id}`} result={result} typeLabel={copy.types[result.type]} />
          )) : null}
        </div>
      ) : null}
    </section>
  );
}

