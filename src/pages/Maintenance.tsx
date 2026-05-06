/**
 * Maintenance Page
 * Displayed when the site is under maintenance.
 * Split layout: message on the left, themed canvas on the right.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import DOMPurify from "dompurify";
import DataStreamCanvas, { type FrameDef, wrapLucideSvg } from "@/components/home/DataStreamCanvas";
import { Logo } from "@/components/Logo";
import { useSiteStatus } from "@/hooks/useSiteStatus";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import "@/styles/auth.css";

const MAINTENANCE_FRAMES: FrameDef[] = [
  { kind: "url", src: "/favicon.svg", scale: 0.78 },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`
    ),
    scale: 0.7,
  },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`
    ),
    scale: 0.7,
  },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>`
    ),
    scale: 0.7,
  },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`
    ),
    scale: 0.7,
  },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`
    ),
    scale: 0.7,
  },
  {
    kind: "svg",
    svg: wrapLucideSvg(
      `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`
    ),
    scale: 0.7,
  },
];

export default function Maintenance() {
  const { data: siteStatus } = useSiteStatus();
  const { user, logout } = useAuth();
  const [heroReducedMotion, setHeroReducedMotion] = useState(false);

  // Log out non-admin users who land here
  useEffect(() => {
    if (user && user.role !== "admin") {
      logout();
    }
  }, [user, logout]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setHeroReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const defaultMessage = `<p>We're currently performing scheduled maintenance to improve your experience. Please check back soon.</p>`;
  const messageHtml = DOMPurify.sanitize(siteStatus?.maintenanceMessageHtml || defaultMessage);

  return (
    <div className="auth-page auth-page--split">
      <div className="auth-page__grid" />
      <div className="auth-page__orb-left" />
      <div className="auth-page__orb-right" />
      <div className="auth-page__orb-bottom" />

      <motion.div
        className="auth-split"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="auth-split__form">
          <Link to="/" className="auth-brand-link" aria-label={`${BRAND_NAME} home`}>
            <span className="auth-brand-link__mark">
              <Logo size="sm" />
            </span>
            <span>{BRAND_NAME}</span>
          </Link>

          <div className="auth-card">
            <div className="auth-card__header">
              <div className="auth-card__icon-wrap !flex">
                <Wrench className="h-5 w-5" />
              </div>
              <h1 className="auth-card__title">Under Maintenance</h1>
              <p className="auth-card__subtitle">
                {BRAND_NAME} is temporarily unavailable
              </p>
            </div>

            <div className="auth-card__body">
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: messageHtml }}
              />
            </div>
          </div>
        </div>

        <div className="auth-split__visual" aria-hidden="true">
          <DataStreamCanvas
            className="absolute inset-0"
            reducedMotion={heroReducedMotion}
            frames={MAINTENANCE_FRAMES}
          />
          <div className="auth-split__visual-fade" />
        </div>
      </motion.div>
    </div>
  );
}
