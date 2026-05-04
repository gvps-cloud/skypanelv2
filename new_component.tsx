export default function HomeRedesign() {
  const [regionCount, setRegionCount] = useState(10);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [activeCapability, setActiveCapability] = useState<CapabilityKey>("deploy");
  const [regionsData, setRegionsData] = useState<RegionData[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionData | null>(null);
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [hostingPlanCount, setHostingPlanCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [regData, priceData, hostingData] = await Promise.all([
          apiClient.get<{ success?: boolean; regions?: any[]; count?: number }>('/pricing/public-regions'),
          apiClient.get<{ plans?: any[] }>('/pricing/vps'),
          apiClient
            .get<{ enabled?: boolean; plans?: any[] }>('/pricing/hosting')
            .catch(() => ({ enabled: false, plans: [] })),
        ]);

        if (!mounted) return;

        if (regData?.success === true) {
          const regions = regData.regions;
          if (Array.isArray(regions) && regions.length > 0) {
            setRegionCount(regions.length);
            setRegionsData(regions as RegionData[]);
          } else {
            const c = parseNumber(regData.count);
            if (c !== null && c > 0) setRegionCount(c);
          }
        }

        if (priceData) {
          const plans = priceData.plans;
          if (Array.isArray(plans)) {
            const values = plans
              .map((p) => {
                const rec = asRecord(p);
                return (parseNumber(rec?.base_price) ?? 0) + (parseNumber(rec?.markup_price) ?? 0);
              })
              .filter((v) => Number.isFinite(v) && v > 0);
            if (values.length > 0) setLowestPrice(Math.min(...values));
          }
        }

        setHostingEnabled(hostingData.enabled === true);
        setHostingPlanCount(hostingData.plans?.length ?? 0);
      } catch {
        // Silently fail - pricing data is optional
      } finally {
        setPricingLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [location.hash]);

  const activeTab = capabilityTabs.find((t) => t.key === activeCapability) ?? capabilityTabs[0];

  const springTransition = { type: "spring", stiffness: 200, damping: 20 };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-primary/30 overflow-hidden">
      <MarketingNavbar />

      <main className="relative flex flex-col">

        {/* 1. THE VOID HERO */}
        <section className="relative min-h-[100svh] flex flex-col justify-center border-b border-white/10 pt-20">
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center mix-blend-screen opacity-60">
            {/* Massive conic/radial gradient background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050505_70%)] z-10" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full" />

            <div className="scale-[1.3] md:scale-150 origin-center opacity-80 pointer-events-auto z-0">
              <ParticleGlobe
                regions={regionsData}
                onRegionSelect={setSelectedRegion}
                selectedRegion={selectedRegion}
                displayMode="pixel"
                disableClick={true}
              />
            </div>
            <GlobeRegionPanel
              region={selectedRegion}
              onClose={() => setSelectedRegion(null)}
            />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-end pb-24 h-full">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-8 flex flex-col justify-end"
            >
              <Badge variant="outline" className="font-mono text-xs tracking-widest text-primary border-primary/30 uppercase bg-primary/5 px-3 py-1 mb-8 w-fit">
                [ INIT SYSTEM ]
              </Badge>
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[100px] font-medium tracking-tighter leading-[0.9] text-white">
                Compute. <br/>
                <span className="text-white/40">Refined.</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-4 flex flex-col justify-end space-y-8"
            >
              <p className="text-lg leading-relaxed text-zinc-400 font-light">
                High-performance virtual machines and managed web hosting. Absolute control without the complexity.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-12 px-6 bg-white text-black hover:bg-zinc-200 transition-colors group rounded-none" asChild>
                  <Link to="/register" className="flex items-center">
                    Deploy Now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 border-white/20 text-white hover:bg-white/5 transition-colors rounded-none" asChild>
                  <Link to="/pricing">Pricing</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2. THE MOCKUP SPOTLIGHT */}
        <section className="relative py-32 bg-[#050505]">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="mx-auto max-w-[1400px] px-6 md:px-12">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16"
            >
              <div>
                <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em]">01 / Interface</h2>
                <h3 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight text-white">
                  Command your fleet.
                </h3>
              </div>
              <p className="max-w-sm text-zinc-400 leading-relaxed font-light">
                A single unified dashboard blending granular server control with high-level organizational oversight.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-10 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative rounded-xl ring-1 ring-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden bg-[#0A0A0A] group">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                <SkyPanelPreview />
                {/* Subtle sheen on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.04)_0%,transparent_50%)] pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* 3. METRICS / TELEMETRY */}
        <section className="border-y border-white/10 bg-[#0A0A0A]">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
              {[
                { label: "Global Locations", value: `${regionCount}+`, detail: "Low-latency delivery" },
                { label: "Avg. Deployment", value: "~45s", detail: "From click to root access" },
                { label: "Uptime SLA", value: "99.9%", detail: "Enterprise reliability" },
              ].map((metric, i) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 md:p-12 hover:bg-white/[0.02] transition-colors"
                >
                  <p className="font-mono text-xs text-primary uppercase tracking-widest mb-4">
                    [ SYS.{i+1} ]
                  </p>
                  <p className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-2">
                    {metric.value.includes("+") || metric.value.includes("%") || metric.value.includes("s") ? (
                      metric.value
                    ) : (
                      <AnimatedCounter
                        value={parseInt(metric.value.replace(/\D/g, "")) || 0}
                        suffix={metric.value.replace(/[\d,]/g, "")}
                      />
                    )}
                  </p>
                  <p className="text-sm text-zinc-500">{metric.label} &mdash; {metric.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. CORE CAPABILITIES (EDITORIAL) */}
        <section id="platform" className="relative py-32 bg-[#050505]">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mb-24 flex flex-col md:flex-row justify-between items-end border-b border-white/10 pb-8">
              <div>
                <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em]">02 / Platform</h2>
                <h3 className="mt-4 text-4xl md:text-6xl font-medium tracking-tight text-white">
                  Architectural rigor.
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
              <div className="lg:col-span-5 space-y-4">
                {capabilityTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCapability(tab.key)}
                    className={`w-full text-left flex items-center justify-between group py-6 border-b border-white/10 transition-colors ${
                      activeCapability === tab.key ? "text-white" : "text-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-xs opacity-50 group-hover:opacity-100 transition-opacity">0{capabilityTabs.indexOf(tab) + 1}</span>
                      <span className="text-2xl font-medium tracking-tight">{tab.label}</span>
                    </div>
                    {activeCapability === tab.key && (
                      <motion.div layoutId="arrow" transition={springTransition}>
                        <ArrowRight className="w-5 h-5 text-primary" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              <div className="lg:col-span-7 relative min-h-[450px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab.key}
                    initial={{ opacity: 0, filter: "blur(10px)", y: 10 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    exit={{ opacity: 0, filter: "blur(10px)", y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="bg-[#0A0A0A] border border-white/10 p-8 md:p-12 h-full flex flex-col"
                  >
                    <activeTab.icon className="w-8 h-8 text-primary mb-8" />
                    <h4 className="text-3xl font-medium text-white mb-4">{activeTab.title}</h4>
                    <p className="text-lg text-zinc-400 font-light leading-relaxed mb-12">
                      {activeTab.description}
                    </p>

                    <div className="grid grid-cols-3 gap-px bg-white/10 mb-12 border border-white/10">
                      {activeTab.callouts.map((item) => (
                        <div key={item.label} className="bg-[#0A0A0A] p-4 sm:p-6 flex flex-col justify-center">
                          <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">{item.label}</p>
                          <p className="text-white font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto space-y-4 border-t border-white/10 pt-8">
                      {activeTab.bullets.map((point, i) => (
                        <div key={point} className="flex items-start gap-4">
                          <span className="font-mono text-xs text-primary mt-1">[{i+1}]</span>
                          <p className="text-sm text-zinc-300 leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* 5. RAW GRID OF FEATURES (Technical Proof) */}
        <section className="border-t border-white/10 bg-[#050505]">
          <div className="mx-auto max-w-7xl px-6 md:px-12 py-32">
            <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em] mb-16">System Capabilities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
              {platformCards.map((card, i) => (
                <div key={card.title} className="bg-[#0A0A0A] p-8 hover:bg-[#0f0f0f] transition-colors group">
                  <card.icon className="w-6 h-6 text-zinc-600 group-hover:text-primary transition-colors mb-8" />
                  <h3 className="text-lg font-medium text-white mb-3">{card.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-8 min-h-[60px]">
                    {card.description}
                  </p>
                  <div className="inline-flex font-mono text-[10px] uppercase tracking-widest border border-white/10 px-3 py-1 text-zinc-400">
                    {card.metric}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. TESTIMONIALS */}
        <section className="py-32 border-t border-white/10 bg-[#050505]">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em] mb-16">03 / Proof of Work</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
              {testimonials.map((test, i) => (
                <div key={i} className="bg-[#0A0A0A] p-10 flex flex-col justify-between">
                  <div className="flex gap-1 mb-8">
                    {[...Array(test.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-primary fill-primary" />
                    ))}
                  </div>
                  <p className="text-lg text-zinc-300 font-light leading-relaxed italic mb-12">
                    &ldquo;{test.quote}&rdquo;
                  </p>

                  <div className="mt-auto">
                    <div className="flex gap-4 items-center mb-6">
                      <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs text-white">
                        {test.avatar}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{test.name}</p>
                        <p className="text-zinc-500 text-xs">{test.role}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-6 border-t border-white/10">
                      {test.results.map((r, k) => (
                        <span key={k} className="font-mono text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-1">
                          {r.metric}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. FAQs */}
        <section className="py-32 border-t border-white/10 bg-[#0A0A0A]">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-[0.2em] mb-16 text-center">04 / F.A.Q.</h2>

            <Accordion type="single" collapsible className="space-y-0 border-y border-white/10">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="border-b border-white/10 last:border-0"
                >
                  <AccordionTrigger className="text-left text-lg font-medium hover:text-white text-zinc-300 hover:no-underline py-6 [&[data-state=open]]:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-zinc-400 font-light pb-8 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* 8. FINAL CTA */}
        <section className="relative py-40 border-t border-white/10 bg-black overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-primary/10 blur-[150px] rounded-[100%] rotate-45" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <Badge variant="outline" className="font-mono text-xs tracking-widest text-primary border-primary/30 uppercase bg-primary/5 px-3 py-1 mb-8">
              [ TERMINAL READY ]
            </Badge>
            <h2 className="text-5xl md:text-7xl font-medium tracking-tight text-white mb-8">
              Start building.
            </h2>
            <p className="text-xl text-zinc-400 font-light mb-16 max-w-2xl mx-auto">
              Join teams already using {BRAND_NAME} for high-performance infrastructure and predictable hourly billing.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
              <Button size="lg" className="h-14 px-8 text-lg bg-white text-black hover:bg-zinc-200 transition-colors rounded-none w-full sm:w-auto" asChild>
                <Link to="/register">Create Account</Link>
              </Button>
              <div className="flex flex-col items-center">
                <span className="font-mono text-sm text-zinc-500 uppercase tracking-widest">Pricing starts at</span>
                <span className="text-3xl font-medium text-white mt-1">
                  {pricingLoading ? "..." : `$${lowestPrice ?? 5}`}<span className="text-sm text-zinc-500 font-normal">/mo</span>
                </span>
              </div>
            </div>
          </div>
        </section>

      </main>

      <MarketingFooter />
    </div>
  );
}
