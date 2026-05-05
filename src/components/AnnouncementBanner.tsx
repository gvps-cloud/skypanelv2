import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { X, Info, AlertTriangle, CheckCircle, Wrench, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  target_audience: string;
  is_dismissable: boolean;
  priority: number;
}

const STORAGE_KEY = "skypanelv2:dismissed-announcements";

const TYPE_STYLES: Record<string, string> = {
  info: "bg-blue-600/90 dark:bg-blue-700/90 text-white border-blue-700 dark:border-blue-800 backdrop-blur-md",
  warning: "bg-amber-500/90 dark:bg-amber-600/90 text-white border-amber-600 dark:border-amber-700 backdrop-blur-md",
  success: "bg-emerald-600/90 dark:bg-emerald-700/90 text-white border-emerald-700 dark:border-emerald-800 backdrop-blur-md",
  maintenance: "bg-orange-500/90 dark:bg-orange-600/90 text-white border-orange-600 dark:border-orange-700 backdrop-blur-md",
  urgent: "bg-red-600/90 dark:bg-red-700/90 text-white border-red-800 dark:border-red-900 backdrop-blur-md",
};

const TYPE_ICONS: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  maintenance: Wrench,
  urgent: AlertOctagon,
};

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function addDismissedId(id: string) {
  const dismissed = getDismissedIds();
  dismissed.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
}

interface AnnouncementBannerProps {
  topOffset?: number;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  topOffset = 0,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await apiClient.get<{ announcements: Announcement[] }>("/announcements");
      if (data.announcements) {
        const dismissed = getDismissedIds();
        setAnnouncements(
          (data.announcements as Announcement[]).filter(
            (a) => !dismissed.has(a.id)
          )
        );
      }
    } catch {
      // Silently fail — announcements are non-critical
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useLayoutEffect(() => {
    if (announcements.length === 0) {
      document.documentElement.style.setProperty(
        "--announcement-banner-height",
        "0px",
      );
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const applyHeight = (height: number) => {
      document.documentElement.style.setProperty(
        "--announcement-banner-height",
        `${height}px`,
      );
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    applyHeight(el.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, [announcements.length]);

  // Reset CSS var when this component is removed from the tree (e.g. route change)
  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty(
        "--announcement-banner-height",
        "0px",
      );
    };
  }, []);

  if (announcements.length === 0) return null;

  const handleDismiss = (id: string, isDismissable: boolean) => {
    if (!isDismissable) return;
    addDismissedId(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      ref={containerRef}
      className="fixed left-0 right-0 z-[45] w-full animate-in fade-in-0 duration-300"
      style={{ top: topOffset }}
    >
      {announcements.map((announcement) => {
        const Icon = TYPE_ICONS[announcement.type] || Info;
        return (
          <div
            key={announcement.id}
            role="banner"
            aria-live="polite"
            className={cn(
              "flex w-full items-center justify-between gap-3 border-b px-4 py-2 text-sm animate-in slide-in-from-top-2 fade-in-0 duration-300",
              TYPE_STYLES[announcement.type] || TYPE_STYLES.info
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium truncate">{announcement.title}</span>
              {announcement.message && (
                <span className="hidden sm:inline truncate">
                  &mdash; {announcement.message}
                </span>
              )}
            </div>
            {announcement.is_dismissable && (
              <button
                onClick={() => handleDismiss(announcement.id, true)}
                className="shrink-0 rounded p-0.5 hover:bg-white/20 transition-colors"
                aria-label="Dismiss announcement"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
