"use client";

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/home.css';

// Get the base URL for display
const getBaseUrl = () => {
  const rawClientUrl = (import.meta.env.VITE_CLIENT_URL || (import.meta.env as Record<string, string | undefined>).CLIENT_URL || '').trim();

  const normalize = (url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const normalizedPath = parsed.pathname.replace(/\/$/, '');
      return `${parsed.host}${normalizedPath || ''}`;
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  };

  const normalizedEnvUrl = normalize(rawClientUrl);
  if (normalizedEnvUrl) {
    return normalizedEnvUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalize(window.location.origin);
  }

  return 'dashboard.skypanel.dev';
};
import {
  ArrowUpRight,
  Check,
  Server,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
  Monitor,
  Terminal,
  TrendingUp,
  Users,
  Star,
  BarChart3,
  Settings,
  Lock,
  Rocket,
  Code,
  Package,
  Timer,
  Shield,
  Wifi,
  Globe2,
  Award,
  Building,
  UserCheck,
  MapPin,
  Quote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Counter component for animated statistics
const AnimatedCounter = ({ value, suffix = '', duration = 2 }: { value: number; suffix?: string; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return <>{count}{suffix}</>;
};

// Hero Section Component
const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center bg-background overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute inset-0 bg-grid-pattern opacity-3 dark:opacity-5" />

      {/* Floating elements */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl"
      />
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-10 w-32 h-32 bg-secondary/10 rounded-full blur-xl"
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/3 right-1/4 w-64 h-64"
      >
        <div className="absolute inset-0 border border-primary/10 rounded-full" />
        <div className="absolute inset-4 border border-primary/5 rounded-full" />
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left gpu-accelerated">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <Badge variant="secondary" className="text-sm px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                Next-Gen Cloud Infrastructure Platform
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            >
              <span className="text-foreground">
                Cloud Infrastructure
                <br />
                Management,
              </span>
              <br />
              <span className="text-primary bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Simplified
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed"
            >
              Deploy VPS instances and applications in seconds with unified billing,
              real-time monitoring, and enterprise-grade security.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex justify-center lg:justify-start mb-12"
            >
              <Button size="lg" className="text-lg px-8 py-4 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                <Link to="/register">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Free Trial
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </motion.div>

            {/* Animated Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid grid-cols-2 gap-6"
            >
              {[
                { value: 45, suffix: 's', label: 'Average Deployment', icon: Timer },
                { value: 99.95, suffix: '%', label: 'Uptime SLA', icon: Shield },
                { value: 18, suffix: '+', label: 'Global Regions', icon: Globe2 },
                { value: 1000, suffix: '+', label: 'Active Servers', icon: Server }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                  className="flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/2 border border-primary/10 hover:border-primary/20 transition-all duration-300 min-h-[120px] group"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                    <stat.icon className="w-7 h-7 text-primary group-hover:text-primary/90" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-3xl font-bold text-foreground min-h-[36px] flex items-center">
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-sm text-muted-foreground leading-tight mt-1">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative order-1 lg:order-2 mt-12 lg:mt-0"
          >
            <div className="relative max-w-lg mx-auto lg:max-w-none">
              {/* Browser Window */}
              <div className="bg-muted rounded-2xl shadow-2xl border border-border overflow-hidden scale-75 sm:scale-90 lg:scale-100 origin-top">
                {/* Browser Header */}
                <div className="bg-muted/80 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-destructive rounded-full" />
                      <div className="w-3 h-3 bg-yellow-600 rounded-full" />
                      <div className="w-3 h-3 bg-green-600 rounded-full" />
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-sm text-muted-foreground font-medium">
                        {getBaseUrl()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard Preview */}
                <div className="p-6 bg-card">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-8 bg-primary/20 rounded w-8" />
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="h-3 bg-primary/20 rounded w-20 mb-2" />
                        <div className="h-6 bg-primary/10 rounded w-16" />
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="h-3 bg-primary/20 rounded w-24 mb-2" />
                        <div className="h-6 bg-primary/10 rounded w-20" />
                      </div>
                    </div>

                    {/* Activity List */}
                    <div className="space-y-2">
                      <div className="h-3 bg-muted/30 rounded w-full" />
                      <div className="h-3 bg-muted/30 rounded w-4/5" />
                      <div className="h-3 bg-muted/30 rounded w-3/4" />
                    </div>

                    {/* Button */}
                    <div className="h-10 bg-primary rounded-lg w-full" />
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg ring-2 ring-primary/20"
              >
                Live Dashboard
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -left-4 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg ring-2 ring-secondary/20"
              >
                Real-time Monitoring
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Trust Badges Section
const TrustBadges = () => (
  <section className="py-16 border-b border-border bg-muted/20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-8"
      >
        {[
          { icon: ShieldCheck, text: "Enterprise Security", colorClass: "text-primary" },
          { icon: Award, text: "99.95% Uptime SLA", colorClass: "text-primary" },
          { icon: Users, text: "1000+ Customers", colorClass: "text-primary" },
          { icon: Lock, text: "GDPR Compliant", colorClass: "text-primary" },
          { icon: CreditCard, text: "PayPal Verified", colorClass: "text-primary" }
        ].map((item, index) => (
          <motion.div
            key={item.text}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -2 }}
            className="flex items-center gap-3 px-6 py-3 bg-background rounded-lg border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300"
          >
            <item.icon className={`w-5 h-5 ${item.colorClass}`} />
            <span className="text-sm font-medium text-foreground">{item.text}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

// Features Showcase ("Platform" section)
const FeaturesShowcase = () => {
  const features = [
    {
      icon: Rocket,
      title: "Instant Deployment",
      description: "Deploy VPS instances and applications in under 45 seconds with our streamlined provisioning system.",
      color: "from-primary to-primary/80"
    },
    {
      icon: Monitor,
      title: "Unified Dashboard",
      description: "Single interface for managing VPS, billing, and monitoring across all providers.",
      color: "from-primary to-primary/80"
    },
    {
      icon: BarChart3,
      title: "Real-time Monitoring",
      description: "Live metrics, alerts, and performance tracking with customizable dashboards.",
      color: "from-primary to-primary/80"
    },
    {
      icon: Terminal,
      title: "Web-based SSH",
      description: "Secure terminal access directly through your browser with full SSH capabilities.",
      color: "from-primary to-primary/80"
    },
    {
      icon: Wallet,
      title: "Flexible Billing",
      description: "Pay-as-you-go pricing with prepaid wallet system and transparent hourly rates.",
      color: "from-primary to-primary/80"
    },
    {
      icon: Wifi,
      title: "Multi-Region",
      description: "Deploy across 18+ global regions for optimal performance and latency.",
      color: "from-primary to-primary/80"
    }
  ];

  return (
    <section id="platform" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Platform Features
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Everything You Need for
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Cloud Infrastructure</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From deployment to monitoring, we've built a comprehensive platform that handles the complexity so you can focus on your applications.
          </p>
        </motion.div>

        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerChildren}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3 }}
              className="group"
            >
              <Card className="h-full bg-background border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                <div className={`h-1 bg-gradient-to-r ${feature.color}`} />
                <CardContent className="p-8">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} p-4 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <feature.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-muted/50 rounded-full border border-border/50">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Plus enterprise-grade security and 24/7 support</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// Live Application Showcase Section ("Capabilities" section)
const LiveShowcase = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const showcaseTabs = [
    {
      id: 'dashboard',
      label: 'Command Center',
      icon: Monitor,
      description: 'Real-time infrastructure monitoring and control',
      features: ['Live VPS metrics', 'Wallet balance', 'Activity feed', 'Quick actions']
    },
    {
      id: 'vps',
      label: 'VPS Management',
      icon: Server,
      description: 'Deploy and manage virtual servers across multiple providers',
      features: ['Performance monitoring', 'Provider selection', 'Instant deployment', 'SSH access']
    },
    {
      id: 'marketplace',
      label: 'Application Marketplace',
      icon: Package,
      description: 'One-click deployment of popular applications',
      features: ['Featured apps', 'Custom deployments', 'Auto-scaling', 'Health monitoring']
    }
  ];

  return (
    <section id="capabilities" className="py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Live Platform Preview
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Experience the
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Power & Simplicity</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See our platform in action with real interfaces and live functionality
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center mb-12 px-4"
        >
          <div className="inline-flex bg-card rounded-xl p-1 shadow-sm border border-border flex-wrap justify-center max-w-full backdrop-blur-sm">
            {showcaseTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 rounded-lg transition-all duration-300 touch-manipulation ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <tab.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            key={`${activeTab}-content`}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-3xl font-bold mb-4">
                {showcaseTabs.find(tab => tab.id === activeTab)?.label}
              </h3>
              <p className="text-lg text-muted-foreground mb-6">
                {showcaseTabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </div>

            <div className="space-y-3">
              {showcaseTabs.find(tab => tab.id === activeTab)?.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-6">
              <Button size="lg" className="px-8 py-3" asChild>
                <Link to="/register">
                  Try It Live
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Right: Screenshot Preview */}
          <motion.div
            key={`${activeTab}-screenshot`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="relative">
              {/* Browser Window Frame */}
              <div className="bg-background rounded-2xl shadow-2xl border border-border overflow-hidden">
                {/* Browser Header */}
                <div className="bg-muted border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-destructive rounded-full" />
                      <div className="w-3 h-3 bg-yellow-600 rounded-full" />
                      <div className="w-3 h-3 bg-green-600 rounded-full" />
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-sm text-muted-foreground font-medium">
                        {activeTab === 'dashboard' && `${getBaseUrl()}/dashboard`}
                        {activeTab === 'vps' && `${getBaseUrl()}/vps`}
                        {activeTab === 'marketplace' && `${getBaseUrl()}/marketplace`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Screenshot Content Area */}
                <div className="relative bg-gradient-to-br from-card to-muted p-8 min-h-[400px]">
                  {/* Live Badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-foreground">Live Preview</span>
                  </div>

                  {/* Tab-specific Content */}
                  {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                          <div className="text-2xl font-bold text-primary mb-1">12</div>
                          <div className="text-sm text-muted-foreground">Active Servers</div>
                        </div>
                        <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                          <div className="text-2xl font-bold text-primary mb-1">$248</div>
                          <div className="text-sm text-muted-foreground">Wallet Balance</div>
                        </div>
                        <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                          <div className="text-2xl font-bold text-primary mb-1">99.9%</div>
                          <div className="text-sm text-muted-foreground">Uptime</div>
                        </div>
                      </div>
                      <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                        <div className="text-sm font-medium text-foreground mb-3">Recent Activity</div>
                        <div className="space-y-2">
                          <div className="h-2 bg-muted rounded w-full" />
                          <div className="h-2 bg-muted rounded w-4/5" />
                          <div className="h-2 bg-muted rounded w-3/4" />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'vps' && (
                    <div className="space-y-6">
                      <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm font-medium text-foreground">VPS Instances</div>
                          <div className="bg-green-600/20 text-green-600 text-xs px-2 py-1 rounded">Online</div>
                        </div>
                        <div className="space-y-3">
                          {['us-east-1-vps-01', 'eu-west-1-app-02', 'asia-south-1-db-01'].map((instance, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                              <div className="flex items-center gap-3">
                                <Server className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">{instance}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-muted rounded h-2">
                                  <div className="w-3/4 h-full bg-primary rounded" />
                                </div>
                                <span className="text-xs text-muted-foreground">75%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'marketplace' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { name: 'WordPress', installs: '2.5k+', color: 'bg-primary' },
                          { name: 'Node.js', installs: '1.8k+', color: 'bg-primary' },
                          { name: 'PostgreSQL', installs: '1.2k+', color: 'bg-primary' },
                          { name: 'Redis', installs: '980+', color: 'bg-primary' }
                        ].map((app, i) => (
                          <div key={i} className="bg-background/80 rounded-lg p-4 border border-border/50 hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-8 h-8 ${app.color} rounded`} />
                              <div className="text-sm font-medium">{app.name}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{app.installs} installs</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive hint */}
                  <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded border border-border/50">
                    <span className="text-xs text-muted-foreground">Click to explore full interface</span>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg"
              >
                Interactive
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Use Cases Section ("Solutions" section)
const UseCases = () => {
  const useCases = [
    {
      icon: Code,
      title: "For Developers",
      description: "Rapid deployment environments with instant access to development servers and testing infrastructure.",
      benefits: ["Deploy dev environments in seconds", "SSH access via web browser", "Collaborate with team members"],
    },
    {
      icon: Settings,
      title: "For DevOps Teams",
      description: "Complete infrastructure management with monitoring, scaling, and automation capabilities.",
      benefits: ["Unified multi-cloud management", "Automated monitoring & alerts", "Infrastructure as code"],
    },
    {
      icon: Rocket,
      title: "For Startups",
      description: "Cost-effective scaling with pay-as-you-go pricing and enterprise-grade features.",
      benefits: ["Start with minimal investment", "Scale as you grow", "Enterprise features from day one"],
    },
    {
      icon: Building,
      title: "For Enterprise",
      description: "White-label solutions with custom branding, advanced security, and dedicated support.",
      benefits: ["White-label customization", "Advanced security features", "Dedicated account management"],
    }
  ];

  return (
    <section id="solutions" className="py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Built For Every Team
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Perfect for
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Every Use Case</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Whether you're a solo developer or running an enterprise, our platform scales to meet your needs.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="group"
            >
              <Card className="h-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary p-4 mb-6 group-hover:scale-110 transition-transform duration-300">
                    <useCase.icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4">{useCase.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">{useCase.description}</p>
                  <ul className="space-y-3">
                    {useCase.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// How It Works Section
const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Sign Up & Add Funds",
      description: "Create your account in minutes and add funds to your wallet using PayPal or other payment methods.",
      icon: UserCheck
    },
    {
      number: "02",
      title: "Choose Your Infrastructure",
      description: "Select from VPS instances or applications from our marketplace. Configure resources and regions.",
      icon: Package
    },
    {
      number: "03",
      title: "Deploy Instantly",
      description: "Launch your infrastructure in under 45 seconds with automated setup and configuration.",
      icon: Rocket
    },
    {
      number: "04",
      title: "Monitor & Manage",
      description: "Track performance, manage resources, and scale your infrastructure through our unified dashboard.",
      icon: BarChart3
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Getting Started
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            From Zero to
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Live Infrastructure</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get your infrastructure up and running in minutes, not hours.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-y-1/2" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                <Card className="h-full bg-card/80 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 group hover:shadow-xl">
                  <CardContent className="p-8 text-center">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold group-hover:scale-110 transition-transform duration-300 shadow-lg ring-4 ring-primary/10">
                        {step.number}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="hidden lg:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent translate-x-1/2" />
                      )}
                    </div>
                    <step.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-3 text-foreground">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Enhanced Testimonials
const Testimonials = () => {
  const testimonials = [
    {
      quote: "The deployment speed is incredible. We went from signup to having our production servers running in under 5 minutes. The unified dashboard gives us complete visibility.",
      name: "Marcus Chen",
      role: "DevOps Engineer • TechCorp",
      rating: 5,
      results: [
        { metric: "99.9% uptime", period: "6 months" },
        { metric: "5 min deploy", period: "vs 2 hours" }
      ],
      avatar: "MC",
      location: "San Francisco, CA"
    },
    {
      quote: "Finally, a platform that combines VPS and application hosting with transparent billing. The cost savings have been significant for our startup.",
      name: "Sarah Williams",
      role: "CTO • StartupXYZ",
      rating: 5,
      results: [
        { metric: "40% cost reduction", period: "monthly" },
        { metric: "2x performance", period: "vs previous" }
      ],
      avatar: "SW",
      location: "Austin, TX"
    },
    {
      quote: "The web-based SSH console and real-time monitoring have transformed how we manage our infrastructure. It's like having a datacenter in our browser.",
      name: "David Rodriguez",
      role: "Infrastructure Lead • DevTeam Inc",
      rating: 5,
      results: [
        { metric: "3x faster deployments", period: "average" },
        { metric: "Zero downtime", period: "12 months" }
      ],
      avatar: "DR",
      location: "Miami, FL"
    }
  ];

  return (
    <section className="py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Trusted by Teams
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            What Our
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Customers Say</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join thousands of satisfied customers who trust SkyPanelV2 for their infrastructure needs.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              className="touch-manipulation"
            >
              <Card className="h-full bg-card/50 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300 hover:shadow-xl gpu-accelerated">
                <CardContent className="p-8">
                  {/* Rating and Location */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-600 fill-current" />
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {testimonial.location}
                    </div>
                  </div>

                  {/* Enhanced Avatar with Status */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center ring-2 ring-primary/20">
                        <span className="text-primary font-bold text-lg">
                          {testimonial.avatar}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-600 rounded-full border-3 border-background flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground font-medium">{testimonial.role}</div>
                    </div>
                  </div>

                  {/* Enhanced Quote with better styling */}
                  <div className="relative mb-6">
                    <Quote className="absolute -top-4 -left-2 w-8 h-8 text-primary/10" />
                    <p className="text-muted-foreground leading-relaxed italic relative z-10 pl-6">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Enhanced Results Section */}
                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="text-sm font-semibold text-foreground mb-3">
                      Key Results:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {testimonial.results.map((result, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-primary/5 text-primary text-sm font-semibold rounded-full border border-primary/20"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {result.metric}
                          <span className="text-xs font-normal opacity-75">({result.period})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Pricing Preview Section
const PricingPreview = () => (
  <section className="py-24 bg-background">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
          Transparent Pricing
        </Badge>
        <h2 className="text-4xl font-bold mb-4">
          Start Small,
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Scale Big</span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          No setup fees, no hidden costs. Pay only for what you use with our transparent hourly billing.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 md:p-12 text-center"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-6xl font-bold text-primary-foreground mb-4">
            $5<span className="text-2xl text-primary-foreground/80">/month</span>
          </div>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Starting from our smallest VPS instances
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-background/20 backdrop-blur-sm rounded-xl p-6">
              <Check className="w-6 h-6 text-primary mx-auto mb-3" />
              <p className="text-primary-foreground">No Setup Fees</p>
            </div>
            <div className="bg-background/20 backdrop-blur-sm rounded-xl p-6">
              <Check className="w-6 h-6 text-primary mx-auto mb-3" />
              <p className="text-primary-foreground">Pay As You Go</p>
            </div>
            <div className="bg-background/20 backdrop-blur-sm rounded-xl p-6">
              <Check className="w-6 h-6 text-primary mx-auto mb-3" />
              <p className="text-primary-foreground">Cancel Anytime</p>
            </div>
          </div>
          <Button size="lg" className="bg-background text-primary hover:bg-background/90 px-8 py-4 text-lg" asChild>
            <Link to="/pricing">
              View Full Pricing
              <ArrowUpRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

// FAQ Section
const FAQ = () => {
  const faqs = [
    {
      question: "How fast can I provision infrastructure?",
      answer: "VPS instances typically deploy in 45-60 seconds. Applications from our marketplace deploy even faster, often in under 30 seconds. Our platform pre-validates configurations to ensure smooth deployment every time."
    },
    {
      question: "Which payment methods are supported?",
      answer: "We support PayPal-backed cards and are currently beta-testing ACH transfers. Every wallet top-up synchronizes instantly and triggers webhook events for automated workflows."
    },
    {
      question: "Can I manage everything from one dashboard?",
      answer: "Yes! Our unified dashboard allows you to create, resize, backup, rebuild, and delete VPS instances, deploy applications, monitor performance, and manage billing - all from one interface."
    },
    {
      question: "Is there a free tier for testing?",
      answer: "The platform itself is free to use - you only pay for the actual cloud provider resources you consume. We offer detailed monitoring and free tier management so you can build without friction."
    },
    {
      question: "How does the billing system work?",
      answer: "We use a prepaid wallet system with hourly billing. Add funds to your wallet via PayPal, and we'll deduct costs hourly based on your actual resource usage. You can view detailed usage reports and set spending alerts."
    }
  ];

  return (
    <section className="py-24 bg-muted/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
            Frequently Asked Questions
          </Badge>
          <h2 className="text-4xl font-bold mb-4">
            Got Questions?
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> We Have Answers</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to know to get started with SkyPanelV2.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden"
              >
                <AccordionTrigger className="px-8 py-6 text-left hover:text-primary hover:no-underline transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-8 pb-6 text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

// Final CTA Section
const FinalCTA = () => (
  <section className="py-24 bg-gradient-to-br from-primary via-primary/80 to-primary">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <Badge variant="outline" className="mb-6 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
          Ready to Transform Your Infrastructure?
        </Badge>
        <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
          Create an account, add funds, deploy your infrastructure.
        </h2>
        <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
          Your first deployment takes minutes. Add funds to your wallet and start deploying VPS instances and applications immediately.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-background text-primary hover:bg-background/90 px-8 py-4 text-lg rounded-xl" asChild>
            <Link to="/register">
              <Rocket className="w-5 h-5 mr-2" />
              Get Started Now
              <ArrowUpRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 px-8 py-4 text-lg rounded-xl backdrop-blur-sm" asChild>
            <Link to="/contact">
              <Users className="w-5 h-5 mr-2" />
              Talk to Sales
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

// Missing icon import
const CreditCard = Wallet;

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        <HeroSection />
        <TrustBadges />
        <FeaturesShowcase />
        <LiveShowcase />
        <UseCases />
        <HowItWorks />
        <Testimonials />
        <PricingPreview />
        <FAQ />
        <FinalCTA />
      </main>

      <MarketingFooter />
    </div>
  );
}
