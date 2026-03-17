import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlaskConical, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <FlaskConical className="h-24 w-24 text-slate-300" />
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-sm font-bold rounded-full w-12 h-12 flex items-center justify-center">
              404
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          실험실 길을 잃으셨나요?
        </h1>

        {/* Description */}
        <p className="text-slate-600 mb-8">
          요청하신 페이지를 찾을 수 없습니다.
          <br />
          URL을 확인하시거나 홈으로 돌아가세요.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              홈으로 가기
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/search">
              <Search className="h-4 w-4 mr-2" />
              제품 검색
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            문제가 계속되면{" "}
            <a
              href="mailto:support@bioinsight-lab.com"
              className="text-blue-600 hover:underline"
            >
              지원팀에 문의
            </a>
            해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

