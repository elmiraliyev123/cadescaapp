import "server-only";

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getReadyPool } from "@/lib/server/users";

export type UniversityRecord = {
  id: string;
  slug: string;
  name: string;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  websiteUrl: string | null;
  emailDomains: string[];
  primaryEmailDomain: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type UniversityAccessRequest = {
  id: string;
  email: string;
  emailDomain: string;
  universityName: string | null;
  country: string | null;
  websiteUrl: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

const SEED_UNIVERSITIES = [
  { slug: "bilkent", name: "Bilkent University", domain: "bilkent.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "metu", name: "Middle East Technical University", domain: "metu.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "hacettepe", name: "Hacettepe University", domain: "hacettepe.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "koc", name: "Koç University", domain: "ku.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "sabanci", name: "Sabancı University", domain: "sabanciuniv.edu", countryCode: "TR", countryName: "Turkey" },
  { slug: "bogazici", name: "Boğaziçi University", domain: "boun.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "itu", name: "Istanbul Technical University", domain: "itu.edu.tr", countryCode: "TR", countryName: "Turkey" },
  { slug: "ada", name: "ADA University", domain: "ada.edu.az", countryCode: "AZ", countryName: "Azerbaijan" },
  { slug: "baku-state", name: "Baku State University", domain: "bsu.edu.az", countryCode: "AZ", countryName: "Azerbaijan" },
  {
    slug: "asoiu",
    name: "Azerbaijan State Oil and Industry University",
    domain: "asoiu.edu.az",
    countryCode: "AZ",
    countryName: "Azerbaijan"
  }
];

let universitySchemaReady = false;
let universitySchemaReadyPromise: Promise<void> | null = null;

function iso(value: Date | string | null | undefined) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function getEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "";
  return normalized.split("@").pop() || "";
}

export function normalizeEmailDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export function normalizeEmailDomains(input: string | string[]) {
  const values = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  return Array.from(
    new Set(
      values
        .map((value) => normalizeEmailDomain(value))
        .filter((value) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value))
    )
  );
}

export function normalizeUniversitySlug(value: string, fallback = "") {
  const candidate = value || fallback;
  return candidate
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniversitySchema(pool: Pool) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS public.universities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      university_email_domain text NOT NULL UNIQUE,
      country_code text,
      country_name text,
      city text,
      website_url text,
      email_domains text[] NOT NULL DEFAULT '{}'::text[],
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS university_email_domain text;
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS country_code text;
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS country_name text;
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS website_url text;
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS email_domains text[];
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    UPDATE public.universities
    SET email_domains = array[lower(university_email_domain)]
    WHERE email_domains IS NULL
      AND university_email_domain IS NOT NULL;

    UPDATE public.universities
    SET email_domains = array_remove(array(
      SELECT DISTINCT lower(btrim(domain))
      FROM unnest(email_domains) AS domain
      WHERE btrim(domain) <> ''
    ), null)
    WHERE email_domains IS NOT NULL;

    UPDATE public.universities
    SET university_email_domain = email_domains[1]
    WHERE (university_email_domain IS NULL OR btrim(university_email_domain) = '')
      AND cardinality(email_domains) > 0;

    ALTER TABLE public.universities ALTER COLUMN email_domains SET DEFAULT '{}'::text[];
    ALTER TABLE public.universities ALTER COLUMN email_domains SET NOT NULL;

    ALTER TABLE public.universities
      DROP CONSTRAINT IF EXISTS universities_status_check,
      ADD CONSTRAINT universities_status_check CHECK (status IN ('active', 'inactive'));

    ALTER TABLE public.universities
      DROP CONSTRAINT IF EXISTS universities_email_domains_not_empty,
      ADD CONSTRAINT universities_email_domains_not_empty CHECK (cardinality(email_domains) > 0);

    CREATE INDEX IF NOT EXISTS universities_email_domains_gin_idx
      ON public.universities USING gin (email_domains);

    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id);
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at timestamptz;

    CREATE TABLE IF NOT EXISTS public.university_access_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      email_domain text NOT NULL,
      university_name text,
      country text,
      website_url text,
      note text,
      status text NOT NULL DEFAULT 'pending',
      user_id text REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.university_access_requests
      DROP CONSTRAINT IF EXISTS university_access_requests_status_check,
      ADD CONSTRAINT university_access_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

    CREATE INDEX IF NOT EXISTS university_access_requests_status_created_idx
      ON public.university_access_requests (status, created_at DESC);

    CREATE INDEX IF NOT EXISTS university_access_requests_email_domain_idx
      ON public.university_access_requests (lower(email_domain));
  `);

  for (const university of SEED_UNIVERSITIES) {
    await pool.query(
      `INSERT INTO public.universities (
         slug, name, university_email_domain, email_domains, country_code, country_name, status
       )
       VALUES ($1, $2, $3, ARRAY[$3], $4, $5, 'active')
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           university_email_domain = EXCLUDED.university_email_domain,
           email_domains = EXCLUDED.email_domains,
           country_code = EXCLUDED.country_code,
           country_name = EXCLUDED.country_name,
           status = 'active',
           updated_at = now()`,
      [university.slug, university.name, university.domain, university.countryCode, university.countryName]
    );
  }
}

export async function ensureUniversitySchemaReady() {
  const pool = await getReadyPool();
  if (!universitySchemaReady) {
    universitySchemaReadyPromise ??= ensureUniversitySchema(pool).then(() => {
      universitySchemaReady = true;
    });
    await universitySchemaReadyPromise;
  }
  return pool;
}

function mapUniversity(row: {
  id: string;
  slug: string;
  name: string;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  website_url: string | null;
  email_domains: string[] | null;
  university_email_domain: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}): UniversityRecord {
  const emailDomains = normalizeEmailDomains(row.email_domains || row.university_email_domain || []);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
    countryName: row.country_name,
    city: row.city,
    websiteUrl: row.website_url,
    emailDomains,
    primaryEmailDomain: emailDomains[0] || row.university_email_domain || "",
    status: row.status === "inactive" ? "inactive" : "active",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapAccessRequest(row: {
  id: string;
  email: string;
  email_domain: string;
  university_name: string | null;
  country: string | null;
  website_url: string | null;
  note: string | null;
  status: string;
  user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): UniversityAccessRequest {
  return {
    id: row.id,
    email: row.email,
    emailDomain: row.email_domain,
    universityName: row.university_name,
    country: row.country,
    websiteUrl: row.website_url,
    note: row.note,
    status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
    userId: row.user_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export async function findActiveUniversityByEmail(email: string) {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) return null;

  const pool = await ensureUniversitySchemaReady();
  const result = await pool.query(
    `SELECT university.*
     FROM public.universities university
     CROSS JOIN LATERAL unnest(university.email_domains) AS domain(value)
     WHERE university.status = 'active'
       AND ($1 = lower(domain.value) OR $1 LIKE ('%.' || lower(domain.value)))
     ORDER BY length(domain.value) DESC
     LIMIT 1`,
    [emailDomain]
  );

  return result.rows[0] ? mapUniversity(result.rows[0]) : null;
}

export async function listActiveUniversities(): Promise<UniversityRecord[]> {
  const pool = await ensureUniversitySchemaReady();
  const result = await pool.query(
    `SELECT *
     FROM public.universities
     WHERE status = 'active'
     ORDER BY name ASC`
  );

  return result.rows.map(mapUniversity);
}

export async function createUniversityAccessRequest(input: {
  email: string;
  universityName?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  note?: string | null;
  userId?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) throw new Error("invalid_university_email");

  const pool = await ensureUniversitySchemaReady();
  const result = await pool.query(
    `INSERT INTO public.university_access_requests (
       id, email, email_domain, university_name, country, website_url, note, user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      email,
      emailDomain,
      input.universityName?.trim() || null,
      input.country?.trim() || null,
      input.websiteUrl?.trim() || null,
      input.note?.trim() || null,
      input.userId || null
    ]
  );

  return mapAccessRequest(result.rows[0]);
}

export async function listUniversityAccessRequests(status: "pending" | "approved" | "rejected" | "all" = "pending") {
  const pool = await ensureUniversitySchemaReady();
  const params: string[] = [];
  const where = status === "all" ? "" : "WHERE status = $1";
  if (status !== "all") params.push(status);

  const result = await pool.query(
    `SELECT *
     FROM public.university_access_requests
     ${where}
     ORDER BY created_at DESC
     LIMIT 100`,
    params
  );

  return result.rows.map(mapAccessRequest);
}

async function appendUniversityDomain(input: {
  name: string;
  slug: string;
  emailDomain: string;
  country?: string | null;
  websiteUrl?: string | null;
}) {
  const pool = await ensureUniversitySchemaReady();
  const domain = normalizeEmailDomain(input.emailDomain);
  const slug = normalizeUniversitySlug(input.slug, domain.split(".")[0] || "university");
  const name = input.name.trim() || domain;

  const existing = await pool.query<{ id: string; email_domains: string[] | null }>(
    `SELECT id, email_domains
     FROM public.universities university
     WHERE slug = $1
        OR EXISTS (
          SELECT 1
          FROM unnest(university.email_domains) AS domain(value)
          WHERE lower(domain.value) = $2
        )
     LIMIT 1`,
    [slug, domain]
  );

  if (existing.rows[0]) {
    const emailDomains = normalizeEmailDomains([...(existing.rows[0].email_domains || []), domain]);
    await pool.query(
      `UPDATE public.universities
       SET name = COALESCE(NULLIF($2, ''), name),
           email_domains = $3,
           university_email_domain = $4,
           country_name = COALESCE(NULLIF($5, ''), country_name),
           website_url = COALESCE(NULLIF($6, ''), website_url),
           status = 'active',
           updated_at = now()
       WHERE id = $1`,
      [existing.rows[0].id, name, emailDomains, emailDomains[0], input.country || "", input.websiteUrl || ""]
    );
    return existing.rows[0].id;
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO public.universities (
       slug, name, university_email_domain, email_domains, country_name, website_url, status
     )
     VALUES ($1, $2, $3, ARRAY[$3], $4, $5, 'active')
     RETURNING id`,
    [slug, name, domain, input.country?.trim() || null, input.websiteUrl?.trim() || null]
  );

  return created.rows[0].id;
}

export async function approveUniversityAccessRequest(requestId: string) {
  const pool = await ensureUniversitySchemaReady();
  const result = await pool.query(
    `SELECT *
     FROM public.university_access_requests
     WHERE id = $1`,
    [requestId]
  );
  const request = result.rows[0] ? mapAccessRequest(result.rows[0]) : null;
  if (!request) throw new Error("request_not_found");

  const universityName = request.universityName || request.emailDomain;
  const slug = normalizeUniversitySlug(universityName, request.emailDomain.split(".")[0] || "university");
  await appendUniversityDomain({
    name: universityName,
    slug,
    emailDomain: request.emailDomain,
    country: request.country,
    websiteUrl: request.websiteUrl
  });

  await pool.query(
    `UPDATE public.university_access_requests
     SET status = 'approved',
         updated_at = now()
     WHERE id = $1`,
    [requestId]
  );
}

export async function rejectUniversityAccessRequest(requestId: string) {
  const pool = await ensureUniversitySchemaReady();
  await pool.query(
    `UPDATE public.university_access_requests
     SET status = 'rejected',
         updated_at = now()
     WHERE id = $1`,
    [requestId]
  );
}
