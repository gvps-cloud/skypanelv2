"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  className?: string;
  encryptedClassName?: string;
  animateOn?: "hover" | "view" | "load";
  characters?: string;
  useOriginalCharsOnly?: boolean;
  revealDirection?: "start" | "end" | "center";
}

export default function DecryptedText({
  text,
  speed = 60,
  maxIterations = 15,
  sequential = false,
  className = "",
  encryptedClassName = "",
  animateOn = "hover",
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?",
  useOriginalCharsOnly = false,
  revealDirection = "start",
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const uniqueChars = useMemo(() => {
    if (!useOriginalCharsOnly) {
      return [] as string[];
    }

    return Array.from(new Set(text.split("")));
  }, [text, useOriginalCharsOnly]);

  const getRandomChar = useCallback(() => {
    if (useOriginalCharsOnly) {
      if (uniqueChars.length === 0) {
        return "";
      }

      return uniqueChars[Math.floor(Math.random() * uniqueChars.length)] ?? "";
    }

    if (characters.length === 0) {
      return "";
    }

    return characters[Math.floor(Math.random() * characters.length)] ?? "";
  }, [characters, uniqueChars, useOriginalCharsOnly]);

  const getRevealOrder = useCallback(
    (length: number) => {
      const indices = Array.from({ length }, (_, i) => i);

      switch (revealDirection) {
        case "end":
          return [...indices].reverse();
        case "center": {
          const center = Math.floor(length / 2);
          const result: number[] = [];
          if (length > 0) {
            result.push(center);
          }
          for (let i = 1; i < length; i++) {
            if (center - i >= 0) result.push(center - i);
            if (center + i < length) result.push(center + i);
          }
          return result;
        }
        default:
          return indices;
      }
    },
    [revealDirection]
  );

  const animatingRef = useRef(false);

  const animate = useCallback(() => {
    if (animatingRef.current) {
      return;
    }

    animatingRef.current = true;
    setIsAnimating(true);
    const textArray = text.split("");
    const revealOrder = sequential ? getRevealOrder(textArray.length) : undefined;
    let iterations = 0;
    const revealedIndices = new Set<number>();

    const interval = window.setInterval(() => {
      setDisplayText((prev) => {
        return prev
          .split("")
          .map((char, index) => {
            if (sequential && revealOrder) {
              const limit = Math.floor(iterations / 2);
              const shouldReveal = revealOrder
                .slice(0, limit)
                .includes(index);

              if (shouldReveal) {
                revealedIndices.add(index);
                return textArray[index];
              }

              if (revealedIndices.has(index)) {
                return textArray[index];
              }
            } else if (iterations > maxIterations) {
              return textArray[index];
            }

            return char === " " ? " " : getRandomChar();
          })
          .join("");
      });

      iterations++;

      const shouldStop = sequential
        ? revealedIndices.size === textArray.length
        : iterations > maxIterations;

      if (shouldStop) {
        window.clearInterval(interval);
        setDisplayText(text);
        setIsAnimating(false);
        animatingRef.current = false;
      }
    }, speed);
  }, [
    getRandomChar,
    getRevealOrder,
    maxIterations,
    sequential,
    speed,
    text,
  ]);

  useEffect(() => {
    if (animateOn === "load") {
      animate();
    }
  }, [animate, animateOn]);

  useEffect(() => {
    if (animateOn === "hover" && isHovered) {
      animate();
    }
  }, [animate, animateOn, isHovered]);

  useEffect(() => {
    if (animateOn === "view" && isVisible) {
      animate();
    }
  }, [animate, animateOn, isVisible]);

  // Intersection Observer for "view" trigger
  useEffect(() => {
    if (animateOn !== "view") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const elementId = `decrypted-text-${text.replace(/\s+/g, "-")}`;
    const element = document.getElementById(elementId);
    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [animateOn, text]);

  const handleMouseEnter = () => {
    if (animateOn === "hover") {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (animateOn === "hover") {
      setIsHovered(false);
    }
  };

  return (
    <span
      id={`decrypted-text-${text.replace(/\s+/g, "-")}`}
      className={cn(
        "inline-block",
        isAnimating ? encryptedClassName : className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={text}
    >
      <span aria-hidden="true">{displayText}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}