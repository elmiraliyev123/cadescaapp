import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppTopBar } from "@/components/app/AppTopBar";
import { EventDetailView } from "@/components/events/EventStudentViews";
import { getPublicUrl } from "@/lib/appConfig";
import { getDiscoverableEventBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getDiscoverableEventBySlug(slug).catch(() => null);
  if (!event) return { title: "Event unavailable | Cadesca", robots: { index: false, follow: false } };
  const canonical = `${getPublicUrl()}/event/${encodeURIComponent(event.slug)}`;
  const description = event.description.replace(/\s+/g, " ").trim().slice(0, 180);
  return {
    title: `${event.title} | Cadesca Events`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title: event.title,
      description,
      siteName: "Cadesca",
      images: event.coverImageUrl ? [{ url: event.coverImageUrl, alt: event.title }] : undefined
    },
    twitter: {
      card: event.coverImageUrl ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: event.coverImageUrl ? [event.coverImageUrl] : undefined
    }
  };
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getDiscoverableEventBySlug(slug);
  if (!event) notFound();
  return (
    <div className="min-h-dvh bg-[#fffaf0]">
      <AppTopBar variant="public" />
      <main className="px-3 py-6 sm:px-6 sm:py-10">
        <EventDetailView event={event} publicView serverNow={new Date().toISOString()} />
      </main>
    </div>
  );
}
