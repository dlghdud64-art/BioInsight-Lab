"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, AlertCircle, Loader2, Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportQuoteAsTSV, exportQuoteAsCSV, type QuoteExportData } from "@/lib/export/quote-export";
import { Metadata } from "next";

interface QuoteItem {
  id: string;
  lineNumber?: number | null;
  name?: string | null;
  brand?: string | null;
  catalogNumber?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  currency?: string | null;
  notes?: string | null;
}

interface Quote {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  currency: string;
  totalAmount?: number | null;
  items: QuoteItem[];
  vendors?: Array<{
    id: string;
    vendorName: string;
    email?: string | null;
    country?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ShareInfo {
  expiresAt?: string | null;
  createdAt: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedQuote() {
      try {
        setLoading(true);
        const response = await fetch(`/api/share/${token}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to load shared quote");
        }

        const data = await response.json();
        setQuote(data.quote);
        setShareInfo(data.share);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quote");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchSharedQuote();
    }
  }, [token]);

  const handleExportTSV = () => {
    if (!quote) return;
    const exportData: QuoteExportData = {
      title: quote.title,
      description: quote.description,
      status: quote.status,
      currency: quote.currency,
      totalAmount: quote.totalAmount,
      items: quote.items,
      createdAt: quote.createdAt,
    };
    exportQuoteAsTSV(exportData);
  };

  const handleExportCSV = () => {
    if (!quote) return;
    const exportData: QuoteExportData = {
      title: quote.title,
      description: quote.description,
      status: quote.status,
      currency: quote.currency,
      totalAmount: quote.totalAmount,
      items: quote.items,
      createdAt: quote.createdAt,
    };
    exportQuoteAsCSV(exportData);
  };

  const formatCurrency = (amount: number | null | undefined, currency: string = "KRW") => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading shared quote...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Quote not found. This link may be invalid, expired, or disabled."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{quote.title}</h1>
            {quote.description && (
              <p className="text-muted-foreground mt-2">{quote.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {quote.status}
          </Badge>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Created: {formatDate(quote.createdAt)}</span>
          </div>
          {shareInfo?.expiresAt && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Expires: {formatDate(shareInfo.expiresAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notice */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Read-Only View</AlertTitle>
        <AlertDescription>
          This is a shared read-only view of the quote. You can view and export the data, but cannot make any changes.
        </AlertDescription>
      </Alert>

      {/* Export Buttons */}
      <div className="flex gap-2 mb-6">
        <Button onClick={handleExportTSV} variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as TSV
        </Button>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export as CSV
        </Button>
      </div>

      {/* Quote Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Items</CardTitle>
          <CardDescription>
            {quote.items.length} item{quote.items.length !== 1 ? "s" : ""} in this quote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Line</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Cat. No.</TableHead>
                <TableHead className="text-center">Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No items in this quote
                  </TableCell>
                </TableRow>
              ) : (
                quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.lineNumber || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{item.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.brand || "-"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {item.catalogNumber || "-"}
                    </TableCell>
                    <TableCell className="text-center">{item.unit || "ea"}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, item.currency || quote.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.lineTotal, item.currency || quote.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {item.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Total */}
          {quote.totalAmount !== null && quote.totalAmount !== undefined && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(quote.totalAmount, quote.currency)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendors */}
      {quote.vendors && quote.vendors.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quote.vendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{vendor.vendorName}</div>
                    {vendor.email && (
                      <div className="text-sm text-muted-foreground">{vendor.email}</div>
                    )}
                  </div>
                  {vendor.country && (
                    <Badge variant="outline">{vendor.country}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
        <p>
          This shared quote link was created on {shareInfo ? formatDate(shareInfo.createdAt) : "N/A"}
        </p>
        <p className="mt-2">
          Powered by AI BioCompare
        </p>
      </div>
    </div>
  );
}
