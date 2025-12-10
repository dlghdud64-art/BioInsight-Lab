"use client";

import { useEffect, useState } from "react";

export default function SearchResultList({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query) return;

    fetch(`/api/search?q=${query}`)
      .then((res) => res.json())
      .then((data) => setResults(data));
  }, [query]);

  if (!query) return <p>검색어를 입력하세요.</p>;
  if (results.length === 0) return <p>검색 결과가 없습니다.</p>;

  return (
    <div className="space-y-4">
      {results.map((p: any) => (
        <div key={p.id} className="border p-4 rounded-lg">
          <h2 className="font-semibold text-lg">{p.name}</h2>
          <p className="text-sm opacity-70">{p.vendor} — {p.category}</p>
          <p className="text-sm">{p.description}</p>

          <div className="text-sm mt-2">
            <span className="font-medium">Spec:</span> {p.spec}
          </div>

          <div className="text-sm">
            <span className="font-medium">Price:</span> {p.price.toLocaleString()}원
          </div>
        </div>
      ))}
    </div>
  );
}

