"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, TrendingUp, Package, Building2, DollarSign, Upload, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProjectName, setImportProjectName] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "vendor" | "category">("none");

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-reports", period, startDate, endDate, organizationId, vendorId, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period !== "custom") params.append("period", period);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (organizationId) params.append("organizationId", organizationId);
      if (vendorId) params.append("vendorId", vendorId);
      if (category) params.append("category", category);

      const response = await fetch(`/api/reports/purchase?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (organizationId) formData.append("organizationId", organizationId);
      if (importProjectName) formData.append("projectName", importProjectName);

      const response = await fetch("/api/purchases/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import ?§Ìå®");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import ?ÑÎ£å",
        description: `${data.imported}Í∞?Íµ¨Îß§?¥Ïó≠???±Í≥µ?ÅÏúºÎ°?Import?òÏóà?µÎãà??`,
      });
      setIsImportDialogOpen(false);
      setImportFile(null);
      setImportProjectName("");
      // Î¶¨Ìè¨???∞Ïù¥???àÎ°úÍ≥†Ïπ®
      queryClient.invalidateQueries({ queryKey: ["purchase-reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import ?§Ìå®",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Î°úÎî© Ï§?..</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/reports");
    return null;
  }

  const metrics = data?.metrics || {};
  const monthlyData = data?.monthlyData || [];
  const vendorData = data?.vendorData || [];
  const categoryData = data?.categoryData || [];
  const details = data?.details || [];
  const budgetUsage = data?.budgetUsage || [];

  // ?àÏÇ∞ Î™©Î°ù Ï°∞Ìöå
  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) return { budgets: [] };
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const budgets = budgetsData?.budgets || [];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Íµ¨Îß§?¥Ïó≠ Î¶¨Ìè¨??/h1>
            <p className="text-muted-foreground mt-1">
              Í∏∞Í∞Ñ/?Ä/Î≤§ÎçîÎ≥?Ï¥?Íµ¨Îß§ Í∏àÏï°Í≥??àÏÇ∞ ?¨Ïö© ?ÅÌô©???ïÏù∏?©Îãà??
            </p>
          </div>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                CSV Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Íµ¨Îß§?¥Ïó≠ CSV Import</DialogTitle>
                <DialogDescription>
                  Í∑∏Î£π?®Ïñ¥/ERP?êÏÑú ?§Ïö¥Î°úÎìú???§Ï†ú Íµ¨Îß§ ?∞Ïù¥?∞Î? ?ÖÎ°ú?úÌïò?∏Ïöî.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">CSV ?åÏùº</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ÏßÄ???ïÏãù: ?†Ïßú, Î≤§Îçî, ?úÌíà, ?òÎüâ, ?®Í?, Ï¥ùÏï°, ?µÌôî ??                  </p>
                </div>
                <div>
                  <Label htmlFor="project-name">?ÑÎ°ú?ùÌä∏Î™?(?†ÌÉù)</Label>
                  <Input
                    id="project-name"
                    value={importProjectName}
                    onChange={(e) => setImportProjectName(e.target.value)}
                    placeholder="?ÑÎ°ú?ùÌä∏/Í≥ºÏ†úÎ™?
                    className="mt-1"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-semibold mb-1">CSV ?ïÏãù ?àÏãú:</p>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`?†Ïßú,Î≤§Îçî,?úÌíà,?òÎüâ,?®Í?,Ï¥ùÏï°,?µÌôî
2024-01-15,Î≤§ÎçîA,ELISA Kit,10,50000,500000,KRW
2024-01-20,Î≤§ÎçîB,Filter,5,10000,50000,KRW`}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsImportDialogOpen(false);
                      setImportFile(null);
                      setImportProjectName("");
                    }}
                    className="flex-1"
                  >
                    Ï∑®ÏÜå
                  </Button>
                  <Button
                    onClick={() => {
                      if (importFile) {
                        importMutation.mutate(importFile);
                      }
                    }}
                    disabled={!importFile || importMutation.isPending}
                    className="flex-1"
                  >
                    {importMutation.isPending ? "Import Ï§?.." : "Import"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ?ÑÌÑ∞ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>?ÑÌÑ∞</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Í∏∞Í∞Ñ</Label>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">?¥Î≤à ??/SelectItem>
                    <SelectItem value="quarter">?¥Î≤à Î∂ÑÍ∏∞</SelectItem>
                    <SelectItem value="year">?¥Î≤à ?∞ÎèÑ</SelectItem>
                    <SelectItem value="custom">Ïª§Ïä§?Ä</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <>
                  <div>
                    <Label>?úÏûë??/Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ï¢ÖÎ£å??/Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI Ïπ¥Îìú */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ï¥?Íµ¨Îß§ Í∏àÏï°</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ??metrics.totalAmount?.toLocaleString() || 0}
              </div>
              {metrics.estimatedAmount !== undefined && metrics.actualAmount !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  ?àÏÉÅ: ??metrics.estimatedAmount.toLocaleString()} / 
                  ?§Ï†ú: ??metrics.actualAmount.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Î≤§Îçî ??/CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.vendorCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">?àÎ™© ??/CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.itemCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Î¶¨Ïä§????/CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.listCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* ?àÏÇ∞ ?¨Ïö©Î•?Ïπ¥Îìú */}
        {budgets.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>?àÏÇ∞ ?¨Ïö©Î•?/CardTitle>
                <Link href="/dashboard/budget">
                  <Button variant="outline" size="sm">
                    ?àÏÇ∞ Í¥ÄÎ¶?                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgets
                  .filter((b: any) => {
                    const now = new Date();
                    return new Date(b.periodStart) <= now && new Date(b.periodEnd) >= now;
                  })
                  .map((budget: any) => {
                    const usage = budget.usage || {};
                    const usageRate = usage.usageRate || 0;
                    const isOverBudget = usageRate > 100;
                    const isWarning = usageRate > 80 && usageRate <= 100;

                    return (
                      <div
                        key={budget.id}
                        className={`p-4 border rounded-lg ${
                          isOverBudget
                            ? "border-red-300 bg-red-50"
                            : isWarning
                            ? "border-orange-300 bg-orange-50"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-semibold">{budget.name}</div>
                            {budget.projectName && (
                              <div className="text-sm text-muted-foreground">
                                ?ÑÎ°ú?ùÌä∏: {budget.projectName}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">?¨Ïö©Î•?/div>
                            <div className={`text-lg font-semibold ${isOverBudget ? "text-red-600" : ""}`}>
                              {usageRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                          <div>
                            <div className="text-muted-foreground">?àÏÇ∞</div>
                            <div className="font-medium">
                              {budget.amount.toLocaleString()} {budget.currency}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">?¨Ïö©</div>
                            <div className="font-medium">
                              {usage.totalSpent?.toLocaleString() || 0} {budget.currency}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">?îÏó¨</div>
                            <div className={`font-medium ${usage.remaining < 0 ? "text-red-600" : ""}`}>
                              {usage.remaining?.toLocaleString() || budget.amount.toLocaleString()}{" "}
                              {budget.currency}
                            </div>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(usageRate, 100)}
                          className={isOverBudget ? "bg-red-200" : isWarning ? "bg-orange-200" : ""}
                        />
                      </div>
                    );
                  })}
                {budgets.filter((b: any) => {
                  const now = new Date();
                  return new Date(b.periodStart) <= now && new Date(b.periodEnd) >= now;
                }).length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    ?ÑÏû¨ ?úÏÑ±?îÎêú ?àÏÇ∞???ÜÏäµ?àÎã§.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ?àÏÉÅ vs ?§Ï†ú ÎπÑÍµê */}
        {metrics.estimatedAmount !== undefined && metrics.actualAmount !== undefined && metrics.actualAmount > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>?àÏÉÅ vs ?§Ï†ú Íµ¨Îß§??ÎπÑÍµê</CardTitle>
              <CardDescription>
                BioInsight Lab?êÏÑú ?ùÏÑ±???àÏÉÅ Íµ¨Îß§?°Í≥º ?§Ï†ú Íµ¨Îß§?°ÏùÑ ÎπÑÍµê?©Îãà??
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">?àÏÉÅ Íµ¨Îß§??/div>
                  <div className="text-2xl font-bold">??metrics.estimatedAmount.toLocaleString()}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">?§Ï†ú Íµ¨Îß§??/div>
                  <div className="text-2xl font-bold">??metrics.actualAmount.toLocaleString()}</div>
                </div>
                <div className={`p-4 border rounded-lg ${
                  metrics.difference && metrics.difference > 0 
                    ? "bg-red-50 border-red-200" 
                    : metrics.difference && metrics.difference < 0
                    ? "bg-green-50 border-green-200"
                    : ""
                }`}>
                  <div className="text-sm text-muted-foreground mb-1">Ï∞®Ïù¥</div>
                  <div className={`text-2xl font-bold ${
                    metrics.difference && metrics.difference > 0 
                      ? "text-red-600" 
                      : metrics.difference && metrics.difference < 0
                      ? "text-green-600"
                      : ""
                  }`}>
                    {metrics.difference && metrics.difference > 0 ? "+" : ""}
                    ??metrics.difference?.toLocaleString() || 0}
                  </div>
                  {metrics.difference && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {metrics.difference > 0 
                        ? `?àÏÉÅÎ≥¥Îã§ ${((metrics.difference / metrics.estimatedAmount) * 100).toFixed(1)}% Ï¥àÍ≥º`
                        : `?àÏÉÅÎ≥¥Îã§ ${((Math.abs(metrics.difference) / metrics.estimatedAmount) * 100).toFixed(1)}% ?àÍ∞ê`
                      }
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>

        {/* Í∑∏Îûò??*/}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>?îÎ≥Ñ Íµ¨Îß§ Í∏àÏï° Ï∂îÏù¥</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `??{value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="amount" fill="#0088FE" name="Íµ¨Îß§ Í∏àÏï°" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Î≤§ÎçîÎ≥?Íµ¨Îß§ ÎπÑÏú®</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={vendorData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {vendorData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `??{value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ?àÏÇ∞ ?¨Ïö©Î•?*/}
        {budgetUsage.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>?àÏÇ∞ ?ÄÎπ??¨Ïö©Î•?/CardTitle>
              <CardDescription>
                ?§Ï†ï???àÏÇ∞ ?ÄÎπ??§Ï†ú ?¨Ïö© Í∏àÏï°???ïÏù∏?????àÏäµ?àÎã§.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetUsage.map((budget: any) => (
                  <div key={budget.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{budget.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {budget.organization} {budget.projectName && `¬∑ ${budget.projectName}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(budget.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                          {new Date(budget.periodEnd).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {budget.usageRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ?¨Ïö©Î•?                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">?àÏÇ∞:</span>
                        <span className="font-semibold">??budget.budgetAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">?¨Ïö©:</span>
                        <span className="font-semibold">??budget.usedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">?îÏó¨:</span>
                        <span className={`font-semibold ${budget.remaining < 0 ? "text-red-600" : ""}`}>
                          ??budget.remaining.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              budget.usageRate >= 100
                                ? "bg-red-500"
                                : budget.usageRate >= 80
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(budget.usageRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ?ÅÏÑ∏ ?åÏù¥Î∏?*/}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Íµ¨Îß§?¥Ïó≠ ?ÅÏÑ∏</CardTitle>
                <CardDescription>
                  ?ÑÌÑ∞ÎßÅÎêú Í∏∞Í∞Ñ??Íµ¨Îß§?¥Ïó≠???ïÏù∏?????àÏäµ?àÎã§.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="group-by" className="text-sm">Í∑∏Î£π??</Label>
                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                  <SelectTrigger id="group-by" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Í∑∏Î£π???ÜÏùå</SelectItem>
                    <SelectItem value="vendor">Î≤§ÎçîÎ≥?/SelectItem>
                    <SelectItem value="category">Ïπ¥ÌÖåÍ≥†Î¶¨Î≥?/SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Î°úÎî© Ï§?..</p>
            ) : details.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ?¥Îãπ Í∏∞Í∞Ñ??Íµ¨Îß§?¥Ïó≠???ÜÏäµ?àÎã§.
              </div>
            ) : groupBy === "none" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>?†Ïßú</TableHead>
                      <TableHead>Ï°∞ÏßÅ</TableHead>
                      <TableHead>?ÑÎ°ú?ùÌä∏</TableHead>
                      <TableHead>Î≤§Îçî</TableHead>
                      <TableHead>Ïπ¥ÌÖåÍ≥†Î¶¨</TableHead>
                      <TableHead>?úÌíàÎ™?/TableHead>
                      <TableHead className="text-right">Í∏àÏï°</TableHead>
                      <TableHead>ÎπÑÍ≥†</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {new Date(item.date).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>{item.organization}</TableCell>
                        <TableCell>{item.project}</TableCell>
                        <TableCell>{item.vendor}</TableCell>
                        <TableCell>
                          {item.category && PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                            ? PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                            : item.category}
                        </TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ??item.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Í∑∏Î£π??Î°úÏßÅ
                  const grouped = new Map<string, any[]>();
                  
                  details.forEach((item: any) => {
                    const key = groupBy === "vendor" 
                      ? (item.vendor || "ÎØ∏Ï???Î≤§Îçî")
                      : (item.category || "ÎØ∏Ï???Ïπ¥ÌÖåÍ≥†Î¶¨");
                    
                    if (!grouped.has(key)) {
                      grouped.set(key, []);
                    }
                    grouped.get(key)!.push(item);
                  });

                  const groupedArray = Array.from(grouped.entries()).sort((a, b) => {
                    const aTotal = a[1].reduce((sum, d) => sum + (d.amount || 0), 0);
                    const bTotal = b[1].reduce((sum, d) => sum + (d.amount || 0), 0);
                    return bTotal - aTotal;
                  });

                  return groupedArray.map(([groupKey, items]) => {
                    const groupTotal = items.reduce((sum, d) => sum + (d.amount || 0), 0);
                    const itemCount = items.length;
                    const displayKey = groupBy === "category" && PRODUCT_CATEGORIES[groupKey as keyof typeof PRODUCT_CATEGORIES]
                      ? PRODUCT_CATEGORIES[groupKey as keyof typeof PRODUCT_CATEGORIES]
                      : groupKey;

                    return (
                      <div key={groupKey} className="border rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{displayKey}</h4>
                              <p className="text-sm text-muted-foreground">
                                {itemCount}Í∞??àÎ™©
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">
                                ??groupTotal.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">Í∑∏Î£π ?©Í≥Ñ</div>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>?†Ïßú</TableHead>
                                <TableHead>Ï°∞ÏßÅ</TableHead>
                                <TableHead>?ÑÎ°ú?ùÌä∏</TableHead>
                                {groupBy === "category" && <TableHead>Î≤§Îçî</TableHead>}
                                <TableHead>?úÌíàÎ™?/TableHead>
                                {groupBy === "vendor" && <TableHead>Ïπ¥ÌÖåÍ≥†Î¶¨</TableHead>}
                                <TableHead className="text-right">Í∏àÏï°</TableHead>
                                <TableHead>ÎπÑÍ≥†</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {new Date(item.date).toLocaleDateString("ko-KR")}
                                  </TableCell>
                                  <TableCell>{item.organization}</TableCell>
                                  <TableCell>{item.project}</TableCell>
                                  {groupBy === "category" && (
                                    <TableCell>{item.vendor}</TableCell>
                                  )}
                                  <TableCell>{item.productName}</TableCell>
                                  {groupBy === "vendor" && (
                                    <TableCell>
                                      {item.category && PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                                        ? PRODUCT_CATEGORIES[item.category as keyof typeof PRODUCT_CATEGORIES]
                                        : item.category}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right font-semibold">
                                    ??item.amount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.notes}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



