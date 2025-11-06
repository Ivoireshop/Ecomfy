import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Users, 
  Ticket, 
  TrendingUp, 
  DollarSign, 
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalPromoCodes: number;
  usedPromoCodes: number;
  totalRevenue: number;
  pendingPayments: number;
  completedPayments: number;
  freeGenerationsUsed: number;
}

interface PromoCodeUsage {
  code: string;
  discount_percentage: number;
  current_uses: number;
  max_uses: number;
  is_active: boolean;
  expires_at: string;
}

interface RecentPayment {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  user_email: string;
}

interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface PaymentMethodData {
  name: string;
  value: number;
  color: string;
}

const FounderDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalPromoCodes: 0,
    usedPromoCodes: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    completedPayments: 0,
    freeGenerationsUsed: 0,
  });
  const [topPromoCodes, setTopPromoCodes] = useState<PromoCodeUsage[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [revenueChartData, setRevenueChartData] = useState<ChartDataPoint[]>([]);
  const [signupsChartData, setSignupsChartData] = useState<ChartDataPoint[]>([]);
  const [paymentMethodsData, setPaymentMethodsData] = useState<PaymentMethodData[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkFounderRole(session.user.id);
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, [navigate]);

  const checkFounderRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // @ts-ignore - Role types will be updated after migration
        .in("role", ["founder", "co_founder"]);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Accès refusé",
          description: "Seuls les fondateurs peuvent accéder au tableau de bord",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      loadDashboardData();
    } catch (error) {
      console.error("Error checking founder role:", error);
      navigate("/");
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load all stats in parallel
      await Promise.all([
        loadUserStats(),
        loadPromoStats(),
        loadRevenueStats(),
        loadRecentPayments(),
        loadChartData(),
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      // Count total users
      const { count: totalUsers, error: usersError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      if (usersError) throw usersError;

      // Count active subscriptions
      const { count: activeSubscriptions, error: subsError } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (subsError) throw subsError;

      // Calculate free generations used (3 - remaining)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("free_generations_remaining");

      if (profilesError) throw profilesError;

      const freeGenerationsUsed = profilesData?.reduce((total, profile) => {
        return total + (3 - (profile.free_generations_remaining || 0));
      }, 0) || 0;

      setStats(prev => ({
        ...prev,
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        freeGenerationsUsed,
      }));
    } catch (error) {
      console.error("Error loading user stats:", error);
    }
  };

  const loadPromoStats = async () => {
    try {
      // @ts-ignore - Table types will be updated after migration
      const { data: promoCodes, error } = await (supabase as any)
        .from("promo_codes")
        .select("*")
        .order("current_uses", { ascending: false })
        .limit(5);

      if (error) throw error;

      const totalPromoCodes = promoCodes?.length || 0;
      const usedPromoCodes = promoCodes?.filter((pc: any) => pc.current_uses > 0).length || 0;

      setTopPromoCodes(promoCodes || []);
      setStats(prev => ({
        ...prev,
        totalPromoCodes,
        usedPromoCodes,
      }));
    } catch (error) {
      console.error("Error loading promo stats:", error);
    }
  };

  const loadRevenueStats = async () => {
    try {
      // Get payment statistics
      const { data: payments, error } = await supabase
        .from("payments")
        .select("amount, status");

      if (error) throw error;

      const totalRevenue = payments?.reduce((sum, payment) => {
        if (payment.status === "completed" || payment.status === "success") {
          return sum + payment.amount;
        }
        return sum;
      }, 0) || 0;

      const completedPayments = payments?.filter(
        p => p.status === "completed" || p.status === "success"
      ).length || 0;

      const pendingPayments = payments?.filter(
        p => p.status === "pending"
      ).length || 0;

      setStats(prev => ({
        ...prev,
        totalRevenue,
        completedPayments,
        pendingPayments,
      }));
    } catch (error) {
      console.error("Error loading revenue stats:", error);
    }
  };

  const loadRecentPayments = async () => {
    try {
      const { data: payments, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          status,
          payment_method,
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch user emails for the payments
      if (payments && payments.length > 0) {
        const userIds = [...new Set(payments.map(p => p.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

        const paymentsWithEmails = payments.map(payment => ({
          ...payment,
          user_email: profileMap.get(payment.user_id) || "N/A",
        }));

        setRecentPayments(paymentsWithEmails as RecentPayment[]);
      }
    } catch (error) {
      console.error("Error loading recent payments:", error);
    }
  };

  const loadChartData = async () => {
    try {
      const daysBack = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Load revenue data over time
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("created_at, amount, payment_method, status")
        .gte("created_at", startDate.toISOString())
        .in("status", ["completed", "success"]);

      if (paymentsError) throw paymentsError;

      // Load signups data over time
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      if (profilesError) throw profilesError;

      // Process revenue data by day
      const revenueByDay = new Map<string, number>();
      const paymentMethodCount = new Map<string, number>();

      payments?.forEach((payment) => {
        const date = new Date(payment.created_at).toISOString().split("T")[0];
        const currentRevenue = revenueByDay.get(date) || 0;
        revenueByDay.set(date, currentRevenue + payment.amount);

        // Count payment methods
        const method = payment.payment_method || "mobile_money";
        paymentMethodCount.set(method, (paymentMethodCount.get(method) || 0) + 1);
      });

      // Process signups data by day
      const signupsByDay = new Map<string, number>();
      profiles?.forEach((profile) => {
        const date = new Date(profile.created_at).toISOString().split("T")[0];
        signupsByDay.set(date, (signupsByDay.get(date) || 0) + 1);
      });

      // Generate chart data for all days in range
      const revenueData: ChartDataPoint[] = [];
      const signupsData: ChartDataPoint[] = [];
      
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const displayDate = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

        revenueData.push({
          date: displayDate,
          value: revenueByDay.get(dateStr) || 0,
        });

        signupsData.push({
          date: displayDate,
          value: signupsByDay.get(dateStr) || 0,
        });
      }

      setRevenueChartData(revenueData);
      setSignupsChartData(signupsData);

      // Process payment methods data
      const colors = ["#2563eb", "#7c3aed", "#06b6d4", "#10b981", "#f59e0b"];
      const methodsData: PaymentMethodData[] = Array.from(paymentMethodCount.entries()).map(
        ([method, count], index) => ({
          name: method === "card" ? "Carte Bancaire" : "Mobile Money",
          value: count,
          color: colors[index % colors.length],
        })
      );

      setPaymentMethodsData(methodsData);
    } catch (error) {
      console.error("Error loading chart data:", error);
    }
  };

  // Reload chart data when time range changes
  useEffect(() => {
    if (!isLoading && session) {
      loadChartData();
    }
  }, [timeRange]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Tableau de Bord Fondateurs</h1>
            <p className="text-muted-foreground">
              Statistiques et performance de VisualPro
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/generator")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisateurs Total
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeSubscriptions} abonnements actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Revenus Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalRevenue.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.completedPayments} paiements complétés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Codes Promo
              </CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usedPromoCodes}</div>
              <p className="text-xs text-muted-foreground mt-1">
                sur {stats.totalPromoCodes} codes créés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Générations Gratuites
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.freeGenerationsUsed}</div>
              <p className="text-xs text-muted-foreground mt-1">
                utilisations au total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Évolution des Performances</CardTitle>
                <CardDescription>Analysez les tendances de votre plateforme</CardDescription>
              </div>
              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as "7d" | "30d" | "90d")}>
                <TabsList>
                  <TabsTrigger value="7d">7 jours</TabsTrigger>
                  <TabsTrigger value="30d">30 jours</TabsTrigger>
                  <TabsTrigger value="90d">90 jours</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="revenue" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="revenue">Revenus</TabsTrigger>
                <TabsTrigger value="signups">Inscriptions</TabsTrigger>
                <TabsTrigger value="methods">Méthodes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="revenue" className="mt-6">
                <div className="h-[300px]">
                  {revenueChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Aucune donnée de revenus disponible
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString()} FCFA`, "Revenus"]}
                          labelStyle={{ color: "#000" }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          name="Revenus (FCFA)"
                          dot={{ fill: "#2563eb", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signups" className="mt-6">
                <div className="h-[300px]">
                  {signupsChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Aucune donnée d'inscriptions disponible
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={signupsChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value: number) => [value, "Inscriptions"]}
                          labelStyle={{ color: "#000" }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="value" 
                          fill="#7c3aed" 
                          name="Nouvelles inscriptions"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="methods" className="mt-6">
                <div className="h-[300px]">
                  {paymentMethodsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Aucune donnée de paiement disponible
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={paymentMethodsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Top Promo Codes */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Top Codes Promo</CardTitle>
              <CardDescription>Les codes les plus utilisés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPromoCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun code promo utilisé
                  </p>
                ) : (
                  topPromoCodes.map((code) => (
                    <div
                      key={code.code}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                          <Ticket className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{code.code}</p>
                          <p className="text-sm text-muted-foreground">
                            -{code.discount_percentage}% de réduction
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {code.current_uses}/{code.max_uses}
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          {code.is_active ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {code.is_active ? "Actif" : "Inactif"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Paiements Récents</CardTitle>
              <CardDescription>Les 10 dernières transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun paiement récent
                  </p>
                ) : (
                  recentPayments.slice(0, 5).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{payment.user_email}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_method} • {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold">
                          {payment.amount.toLocaleString()} FCFA
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            payment.status === "completed" || payment.status === "success"
                              ? "bg-green-100 text-green-800"
                              : payment.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
            <CardDescription>Accès rapide aux fonctionnalités principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate("/promo-codes")}
              >
                <Ticket className="h-6 w-6" />
                <span>Gérer les Codes Promo</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate("/payment-history")}
              >
                <Calendar className="h-6 w-6" />
                <span>Historique des Paiements</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate("/generator")}
              >
                <TrendingUp className="h-6 w-6" />
                <span>Générateur de Visuels</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FounderDashboard;
