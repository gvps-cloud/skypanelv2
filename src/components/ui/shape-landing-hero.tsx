"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";

interface HeroGeometricProps {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
  className?: string;
}

// Elegant floating shape component
const ElegantShape = ({ 
  delay = 0, 
  className = "",
  children 
}: { 
  delay?: number; 
  className?: string;
  children?: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 20 }}
    animate={{ 
      opacity: 1, 
      scale: 1, 
      y: 0,
      rotate: [0, 5, -5, 0],
    }}
    transition={{
      duration: 0.8,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94],
      rotate: {
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }}
    className={cn("absolute", className)}
  >
    {children}
  </motion.div>
);

export function HeroGeometric({
  badge = "shadcn.io",
  title1 = "Elevate Your Digital Vision",
  title2 = "Crafting Exceptional Websites",
  description = "Crafting exceptional digital experiences with cutting-edge technology and innovative design solutions that captivate audiences and drive meaningful engagement.",
  className = ""
}: HeroGeometricProps) {
  return (
    // Reduce the min-height and vertically center the content to avoid
    // large empty space below the hero (screenshots showed a big gap).
    <div className={cn("relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-background py-32", className)}>
      {/* Floating geometric shapes */}
      <ElegantShape delay={0} className="top-20 left-20 w-16 h-16 opacity-20">
        <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/20 rounded-full blur-sm" />
      </ElegantShape>
      
      <ElegantShape delay={0.2} className="top-40 right-32 w-24 h-24 opacity-15">
        <div className="w-full h-full bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-lg rotate-45 blur-sm" />
      </ElegantShape>
      
      <ElegantShape delay={0.4} className="bottom-32 left-32 w-20 h-20 opacity-25">
        <div className="w-full h-full bg-gradient-to-br from-accent/40 to-accent/20 rounded-full blur-sm" />
      </ElegantShape>
      
      <ElegantShape delay={0.6} className="bottom-20 right-20 w-32 h-32 opacity-10">
        <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg rotate-12 blur-sm" />
      </ElegantShape>
      
      <ElegantShape delay={0.8} className="top-1/2 left-10 w-12 h-12 opacity-30">
        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 rounded-full blur-sm" />
      </ElegantShape>
      
      <ElegantShape delay={1} className="top-1/3 right-10 w-28 h-28 opacity-15">
        <div className="w-full h-full bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-lg rotate-45 blur-sm" />
      </ElegantShape>

      {/* Main content */}
      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-4"
        >
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
            {badge}
          </span>
        </motion.div>

        {/* Title */}
        <div className="mb-4 overflow-visible">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.4] mb-4"
          >
            {title1}
          </motion.h1>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.4] bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent"
          >
            {title2}
          </motion.h1>
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-6"
        >
          {description}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="mt-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button size="lg" asChild className="min-w-[200px]">
              <Link to="/register">
                Get Started Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="min-w-[200px]">
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            No credit card required • 30-day free trial
          </p>
        </motion.div>
      </div>

      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/50 pointer-events-none" />
    </div>
  );
}