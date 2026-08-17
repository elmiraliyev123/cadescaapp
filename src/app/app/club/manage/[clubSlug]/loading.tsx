export default function ManagedClubLoading() {
  return <div role="status" aria-label="Loading club workspace" className="animate-pulse"><div className="h-4 w-28 rounded bg-black/10" /><div className="mt-4 h-10 w-64 max-w-full rounded bg-black/10" /><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="h-28 rounded-2xl bg-white" />)}</div><span className="sr-only">Loading club workspace</span></div>;
}
