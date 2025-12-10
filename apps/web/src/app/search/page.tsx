import SearchResultList from "./SearchResultList";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">검색 결과</h1>
      <SearchResultList query={q} />
    </div>
  );
}
