import { KlaimscanDashboard } from "@/components/dashboard/klaimscan-dashboard";
import { getServerConfigStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const serverConfig = getServerConfigStatus();
  return <KlaimscanDashboard initialServerConfig={serverConfig} />;
}
