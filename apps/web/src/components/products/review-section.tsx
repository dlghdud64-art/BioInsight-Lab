"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { useProductReviews, useCreateReview, useDeleteReview } from "@/hooks/use-reviews";
import { cn } from "@/lib/utils";

interface ReviewSectionProps {
  productId: string;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { data: session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  const { data, isLoading } = useProductReviews(productId, { limit: 10 });
  const createReview = useCreateReview();
  const deleteReview = useDeleteReview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert("평점을 선택해주세요.");
      return;
    }

    try {
      await createReview.mutateAsync({
        productId,
        rating,
        title: title || undefined,
        comment: comment || undefined,
        pros: pros || undefined,
        cons: cons || undefined,
      });
      setShowForm(false);
      setRating(0);
      setTitle("");
      setComment("");
      setPros("");
      setCons("");
    } catch (error: any) {
      alert(error.message || "리뷰 작성에 실패했습니다.");
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("리뷰를 삭제하시겠습니까?")) return;
    try {
      await deleteReview.mutateAsync({ reviewId, productId });
    } catch (error: any) {
      alert(error.message || "리뷰 삭제에 실패했습니다.");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">리뷰를 불러오는 중...</div>;
  }

  const reviews = data?.reviews || [];
  const averageRating = data?.averageRating || 0;
  const totalReviews = data?.totalReviews || 0;
  const ratingDistribution = data?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <div className="space-y-6">
      {/* 평점 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>리뷰 및 평점</CardTitle>
          <CardDescription>
            {totalReviews > 0
              ? `${totalReviews}개의 리뷰 • 평균 ${averageRating.toFixed(1)}점`
              : "아직 리뷰가 없습니다"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalReviews > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-5 w-5",
                        star <= Math.round(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      )}
                    />
                  ))}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {totalReviews}개 리뷰
                </div>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingDistribution[star] || 0;
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-8">{star}점</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-muted-foreground">
                        {count}개
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {session && (
            <Button
              variant="outline"
              onClick={() => setShowForm(!showForm)}
              className="w-full"
            >
              {showForm ? "리뷰 작성 취소" : "리뷰 작성하기"}
            </Button>
          )}

          {!session && (
            <p className="text-sm text-muted-foreground text-center">
              리뷰를 작성하려면 로그인이 필요합니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 리뷰 작성 폼 */}
      {showForm && session && (
        <Card>
          <CardHeader>
            <CardTitle>리뷰 작성</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>평점</Label>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 transition-colors",
                          star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="title">제목 (선택)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="리뷰 제목을 입력하세요"
                />
              </div>

              <div>
                <Label htmlFor="comment">리뷰 내용</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="제품 사용 경험을 공유해주세요"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pros">장점 (선택)</Label>
                  <Textarea
                    id="pros"
                    value={pros}
                    onChange={(e) => setPros(e.target.value)}
                    placeholder="이 제품의 장점"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="cons">단점 (선택)</Label>
                  <Textarea
                    id="cons"
                    value={cons}
                    onChange={(e) => setCons(e.target.value)}
                    placeholder="이 제품의 단점"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createReview.isPending}
                  className="flex-1"
                >
                  {createReview.isPending ? "작성 중..." : "리뷰 등록"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setRating(0);
                    setTitle("");
                    setComment("");
                    setPros("");
                    setCons("");
                  }}
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 리뷰 목록 */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">리뷰 ({totalReviews}개)</h3>
          {reviews.map((review: any) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        {review.user?.image ? (
                          <img
                            src={review.user.image}
                            alt={review.user.name || "User"}
                            className="w-full h-full rounded-full"
                          />
                        ) : (
                          <span className="text-sm font-medium">
                            {review.user?.name?.[0] || "U"}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {review.user?.name || "익명"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "h-4 w-4",
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {review.title && (
                    <div className="font-semibold">{review.title}</div>
                  )}

                  {review.comment && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}

                  {(review.pros || review.cons) && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {review.pros && (
                        <div>
                          <div className="font-medium text-green-600 mb-1">장점</div>
                          <p className="text-muted-foreground">{review.pros}</p>
                        </div>
                      )}
                      {review.cons && (
                        <div>
                          <div className="font-medium text-red-600 mb-1">단점</div>
                          <p className="text-muted-foreground">{review.cons}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {session?.user?.id === review.userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(review.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviews.length === 0 && totalReviews === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!
          </CardContent>
        </Card>
      )}
    </div>
  );
}