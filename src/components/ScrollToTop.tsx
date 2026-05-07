import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document
        .querySelectorAll<HTMLElement>(".terminal-main-scroll")
        .forEach((scrollContainer) => {
          scrollContainer.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
    };

    scrollToTop();
    const frameId = window.requestAnimationFrame(scrollToTop);

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, search]);

  return null;
}
