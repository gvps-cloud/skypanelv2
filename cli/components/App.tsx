import React, { useState, useCallback, useRef } from "react";
import { useKeyboard } from "@opentui/react";
import { Sidebar, type ScreenId } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { Toast, type ToastMessage } from "./Toast.js";
import { UsersScreen } from "../screens/UsersScreen.js";
import { OrgsScreen } from "../screens/OrgsScreen.js";
import { VpsScreen } from "../screens/VpsScreen.js";
import { HostingScreen } from "../screens/HostingScreen.js";
import { TicketsScreen } from "../screens/TicketsScreen.js";
import { BillingScreen } from "../screens/BillingScreen.js";
import { PlatformScreen } from "../screens/PlatformScreen.js";
import { BlogScreen } from "../screens/BlogScreen.js";
import { MetricsScreen } from "../screens/MetricsScreen.js";

type ScreenProps = { toast: (msg: string, type?: "success" | "error") => void };

const SCREENS: Record<ScreenId, React.FC<ScreenProps>> = {
  users: UsersScreen,
  orgs: OrgsScreen,
  vps: VpsScreen,
  hosting: HostingScreen,
  tickets: TicketsScreen,
  billing: BillingScreen,
  platform: PlatformScreen,
  blog: BlogScreen,
  metrics: MetricsScreen,
};

const SCREEN_KEYS: Record<string, ScreenId> = {
  "1": "metrics",
  "2": "users",
  "3": "orgs",
  "4": "vps",
  "5": "hosting",
  "6": "tickets",
  "7": "billing",
  "8": "platform",
  "9": "blog",
};

export function App({ user }: { user: { email: string; role: string } }) {
  const [screen, setScreen] = useState<ScreenId>("metrics");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const ScreenComponent = SCREENS[screen];

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return;
    const target = SCREEN_KEYS[key.name];
    if (target) {
      setScreen(target);
    }
  });

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        <Sidebar current={screen} onSelect={setScreen} />
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <ScreenComponent key={screen} toast={showToast} />
        </box>
      </box>
      <StatusBar user={user} />
      {toast && <Toast message={toast.message} type={toast.type} />}
    </box>
  );
}
