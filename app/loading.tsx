import CompactDataLoader from "@/components/compact-data-loader";

export default function Loading() {
  return (
    <main className="route-loading-page" aria-busy="true">
      <CompactDataLoader />
    </main>
  );
}
