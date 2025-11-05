import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, Users, Globe, TrendingUp, Monitor, Smartphone, Tablet } from "lucide-react";

interface AnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  topCountries: Array<{ country: string; count: number }>;
  topDevices: Array<{ device: string; count: number }>;
  recentVisits: Array<{
    visited_at: string;
    visitor_country: string;
    device_type: string;
    browser: string;
  }>;
}

interface AnalyticsViewerProps {
  showcaseId: string;
}

export const AnalyticsViewer = ({ showcaseId }: AnalyticsViewerProps) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [showcaseId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_analytics")
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("visited_at", { ascending: false });

      if (error) throw error;

      // Process analytics data
      const totalVisits = data.length;
      const uniqueSessions = new Set(data.map((v) => v.session_id)).size;
      
      // Top countries
      const countryCounts = data.reduce((acc: any, visit) => {
        const country = visit.visitor_country || "Unknown";
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});
      const topCountries = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top devices
      const deviceCounts = data.reduce((acc: any, visit) => {
        const device = visit.device_type || "Desktop";
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});
      const topDevices = Object.entries(deviceCounts)
        .map(([device, count]) => ({ device, count: count as number }))
        .sort((a, b) => b.count - a.count);

      setAnalytics({
        totalVisits,
        uniqueVisitors: uniqueSessions,
        topCountries,
        topDevices,
        recentVisits: data.slice(0, 10),
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des visites</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalVisits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visiteurs uniques</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueVisitors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pays différents</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.topCountries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de visite</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalVisits > 0 
                ? ((analytics.uniqueVisitors / analytics.totalVisits) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Countries */}
      <Card>
        <CardHeader>
          <CardTitle>Pays les plus actifs</CardTitle>
          <CardDescription>
            Répartition géographique de vos visiteurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée géographique</p>
            ) : (
              analytics.topCountries.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{item.country}</span>
                  </div>
                  <Badge variant="secondary">{item.count} visites</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Appareils utilisés</CardTitle>
          <CardDescription>
            Répartition par type d'appareil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.topDevices.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(item.device)}
                  <span className="capitalize">{item.device}</span>
                </div>
                <Badge variant="secondary">{item.count} visites</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Visits */}
      <Card>
        <CardHeader>
          <CardTitle>Visites récentes</CardTitle>
          <CardDescription>
            Les 10 dernières visites sur votre site
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recentVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune visite récente</p>
            ) : (
              analytics.recentVisits.map((visit, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(visit.device_type || "Desktop")}
                      <span className="font-medium">
                        {visit.visitor_country || "Unknown"}
                      </span>
                      {visit.browser && (
                        <Badge variant="outline" className="text-xs">
                          {visit.browser}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(visit.visited_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
