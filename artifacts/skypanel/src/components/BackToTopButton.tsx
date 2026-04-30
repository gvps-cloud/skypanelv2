import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

/**
 * Global back-to-top button that appears when the user scrolls down.
 * Positioned bottom-right with mobile-responsive padding.
 */
export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.92 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 rounded-full border border-border bg-background/90 p-3 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </motion.button>
  );
}
