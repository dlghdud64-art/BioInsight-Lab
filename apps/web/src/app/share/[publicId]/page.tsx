import { Metadata } from "next";
import { SharedListView } from "./_components/shared-list-view";

export async function generateMetadata({
  params,
}: {
  params: { publicId: string };
}): Promise<Metadata> {
  return {
    title: "품목 리스트 공유",
    description: "BioInsight Lab 품목 리스트 공유 페이지",
    robots: "noindex, nofollow", // 검색엔진 차단
  };
}

export default async function SharedListPage({
  params,
}: {
  params: { publicId: string };
}) {
  return <SharedListView publicId={params.publicId} />;
}



