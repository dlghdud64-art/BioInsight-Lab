import SearchResultList from "./SearchResultList";
import { SearchInput } from "@/components/SearchInput";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">제품 검색</h1>
      <div className="mb-6">
        <SearchInput />
      </div>
      {q && (
        <>
          <h2 className="text-lg font-semibold mb-4">검색 결과</h2>
          <SearchResultList query={q} />
        </>
      )}
      {!q && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">검색어를 입력하세요.</p>
          <p className="text-sm">예: PBS, FBS, Trypsin, 피펫, 원심분리기, 시약, 소모품, 장비</p>
        </div>
      )}
    </div>
  );
}
