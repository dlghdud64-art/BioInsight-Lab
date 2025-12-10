"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export function SearchInput() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={onSearch} className="flex gap-2 w-full max-w-xl">
      <Input
        placeholder="제품명, 벤더, 시약명 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}

