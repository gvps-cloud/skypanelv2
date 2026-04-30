import { IPAddressTable } from "./IPAddressTable";
import { VLANTable } from "./VLANTable";
import { IPAssignPanel } from "./IPAssignPanel";
import { IPSharePanel } from "./IPSharePanel";
import { FirewallManager } from "./FirewallManager";

interface NetworkingDashboardProps {
  tab: string;
}

export function NetworkingDashboard({ tab }: NetworkingDashboardProps) {
  switch (tab) {
    case "ips":
      return <IPAddressTable />;
    case "vlans":
      return <VLANTable />;
    case "firewalls":
      return <FirewallManager />;
    case "assign":
      return <IPAssignPanel />;
    case "share":
      return <IPSharePanel />;
    default:
      return <IPAddressTable />;
  }
}
