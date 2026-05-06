import React, { useState, useMemo } from "react";
import { Palette, Plus, Terminal, Hash, Pipette, Sparkles } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ThemePreset } from "@/theme/presets";
import { DEFAULT_THEME_ID, generateCustomTheme } from "@/theme/presets";

/* ------------------------------------------------------------------ */
/*  Quick-select preset swatches for the custom color picker           */
/* ------------------------------------------------------------------ */
const QUICK_COLORS = [
  { label: "Indigo", hex: "#6366f1" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Rose", hex: "#f43f5e" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Lagoon", hex: "#1388c3" },
  { label: "Violet", hex: "#8b5cf6" },
  { label: "Pink", hex: "#ec4899" },
  { label: "Sky", hex: "#0ea5e9" },
  { label: "Lime", hex: "#84cc16" },
  { label: "Orange", hex: "#f97316" },
  { label: "Fuchsia", hex: "#d946ef" },
  { label: "Teal", hex: "#14b8a6" },
] as const;

type PickerTab = "picker" | "hex" | "presets";

interface AdminThemeSectionProps {
  themeConfigLoading: boolean;
  formattedThemeUpdatedAt: string;
  orderedThemes: ThemePreset[];
  themeId: string;
  savingPresetId: string | null;
  onSelectPreset: (preset: ThemePreset) => void;
}

export const AdminThemeSection: React.FC<AdminThemeSectionProps> = ({
  themeConfigLoading,
  formattedThemeUpdatedAt,
  orderedThemes,
  themeId,
  savingPresetId,
  onSelectPreset,
}) => {
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#6366f1");
  const [customError, setCustomError] = useState<string | null>(null);
  const [activePickerTab, setActivePickerTab] = useState<PickerTab>("picker");

  const isCustomActive = themeId === "custom";

  const handleOpenCustomPicker = () => {
    setCustomColor("#6366f1");
    setCustomError(null);
    setActivePickerTab("picker");
    setCustomPickerOpen(true);
  };

  const handleHexInput = (value: string) => {
    // Auto-prepend # if missing
    const v = value.startsWith("#") ? value : `#${value}`;
    setCustomColor(v);
    setCustomError(null);
  };

  const handleConfirmCustom = () => {
    const preset = generateCustomTheme(customColor);
    if (!preset) {
      setCustomError("ERR: Invalid hex color");
      return;
    }
    setCustomPickerOpen(false);
    onSelectPreset(preset);
  };

  // Live preview of the custom theme
  const customPreview = useMemo(() => generateCustomTheme(customColor), [customColor]);

  return (
    <>
      {/* Hero header */}
      <div className="relative mb-6 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--primary-rgb,0,255,128),0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--primary-rgb,0,255,128),0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3 font-mono text-xs uppercase tracking-widest">
            <Terminal className="mr-1.5 h-3 w-3" />
            sys.theme
          </Badge>
          <h2 className="font-mono text-3xl font-bold tracking-tight md:text-4xl">
            Theme Manager
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-sm text-muted-foreground">
            <span className="text-primary">$</span> Choose a theme preset that updates instantly for all users
          </p>
          {!themeConfigLoading && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              <span className="text-primary/60">&gt;</span> Last sync: {formattedThemeUpdatedAt}
            </p>
          )}
          {themeConfigLoading && (
            <p className="mt-1 font-mono text-xs text-primary animate-pulse">
              &gt; Syncing configuration...
            </p>
          )}
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Palette className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      {/* Preset grid */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary/60">&gt;_</span>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
              Theme Presets
            </h3>
          </div>
          <p className="mt-1 pl-6 font-mono text-xs text-muted-foreground">
            Apply a built-in palette. Changes propagate to all organization members.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedThemes.map((preset) => {
              const isActive = preset.id === themeId;
              const isDefault = preset.id === DEFAULT_THEME_ID;
              const isSaving = savingPresetId === preset.id;
              const disabled =
                (savingPresetId !== null && savingPresetId !== preset.id) ||
                themeConfigLoading;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  disabled={disabled}
                  className={`group relative w-full rounded-lg border p-4 text-left font-mono transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        {preset.label}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {preset.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {isDefault && (
                        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                          Default
                        </Badge>
                      )}
                      <Badge
                        variant={isActive ? "default" : "outline"}
                        className="font-mono text-[10px]"
                      >
                        {isSaving ? "saving..." : isActive ? "● active" : "○ apply"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">pri</span>
                      <span
                        className="h-7 w-7 rounded border border-border/60 shadow-sm transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `hsl(${preset.light.primary})` }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">bg</span>
                      <span
                        className="h-7 w-7 rounded border border-border/60 shadow-sm transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `hsl(${preset.light.background})` }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">dk</span>
                      <span
                        className="h-7 w-7 rounded border border-border/60 shadow-sm transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `hsl(${preset.dark.primary})` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Custom theme card */}
            <button
              type="button"
              onClick={handleOpenCustomPicker}
              disabled={savingPresetId !== null || themeConfigLoading}
              className={`group relative w-full rounded-lg border-2 border-dashed p-4 text-left font-mono transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isCustomActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/40 hover:border-primary/50 hover:bg-muted/30"
              } ${savingPresetId !== null || themeConfigLoading ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Custom
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Define your own brand palette
                  </p>
                </div>
                <Badge
                  variant={isCustomActive ? "default" : "outline"}
                  className="font-mono text-[10px]"
                >
                  {savingPresetId === "custom" ? "saving..." : isCustomActive ? "● active" : "+ create"}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded border-2 border-dashed border-border/60 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: customColor }}
                />
                <span className="text-xs text-muted-foreground">
                  {customColor}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                <Plus className="h-3 w-3" />
                <span>Configure</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Custom Color Picker Dialog — Terminal-style                     */}
      {/* ================================================================ */}
      <Dialog open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
        <DialogContent className="border-primary/20 bg-card font-mono sm:max-w-lg [&>button]:text-muted-foreground">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 font-mono text-base">
              <Terminal className="h-4 w-4 text-primary" />
              custom_theme.config
            </DialogTitle>
            <p className="font-mono text-xs text-muted-foreground">
              <span className="text-primary">$</span> Pick a primary color. Surface tokens inherit from mono baseline.
            </p>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-1">
            {([
              { id: "picker" as const, label: "Picker", icon: Pipette },
              { id: "hex" as const, label: "Hex", icon: Hash },
              { id: "presets" as const, label: "Swatches", icon: Palette },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActivePickerTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
                  activePickerTab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[200px] space-y-4 py-1">
            {/* Visual Picker */}
            {activePickerTab === "picker" && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full rounded-lg border border-border/60 overflow-hidden" style={{ height: "12rem" }}>
                  <HexColorPicker
                    color={customColor}
                    onChange={(c) => { setCustomColor(c); setCustomError(null); }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">#</span>
                  <span className="text-sm font-semibold text-foreground">{customColor.replace("#", "").toUpperCase()}</span>
                </div>
              </div>
            )}

            {/* Hex Input */}
            {activePickerTab === "hex" && (
              <div className="space-y-3">
                <label className="block text-xs text-muted-foreground">
                  <span className="text-primary">&gt;</span> Enter hex color value:
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 shrink-0 rounded-lg border border-border/60 shadow-sm"
                    style={{ backgroundColor: customColor }}
                  />
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">#</span>
                    <input
                      type="text"
                      value={customColor.replace("#", "")}
                      onChange={(e) => handleHexInput(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border/60 bg-muted/30 pl-7 pr-3 font-mono text-sm text-foreground uppercase placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="6366F1"
                      maxLength={6}
                      spellCheck={false}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Format: 6-digit hex (e.g. 6366F1, 10B981, F43F5E)
                </p>
              </div>
            )}

            {/* Preset Swatches */}
            {activePickerTab === "presets" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary">&gt;</span> Quick-select a brand color:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_COLORS.map((swatch) => {
                    const isSelected = customColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => { setCustomColor(swatch.hex); setCustomError(null); }}
                        className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border/40 hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        <span
                          className={`h-8 w-8 rounded-md border shadow-sm transition-transform group-hover:scale-110 ${
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/60"
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span className="text-[10px] text-muted-foreground">{swatch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Live Preview
            </p>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Light</span>
                <div className="flex gap-1">
                  <div
                    className="h-8 w-12 rounded-md border border-border/60 shadow-sm"
                    style={{ backgroundColor: `hsl(${customPreview?.light.primary ?? "0 0% 50%"})` }}
                  />
                  <div
                    className="h-8 w-12 rounded-md border border-border/60 shadow-sm"
                    style={{ backgroundColor: `hsl(${customPreview?.light.background ?? "0 0% 100%"})` }}
                  />
                </div>
              </div>
              <div className="h-8 w-px bg-border/40" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Dark</span>
                <div className="flex gap-1">
                  <div
                    className="h-8 w-12 rounded-md border border-border/60 shadow-sm"
                    style={{ backgroundColor: `hsl(${customPreview?.dark.primary ?? "0 0% 50%"})` }}
                  />
                  <div
                    className="h-8 w-12 rounded-md border border-border/60 shadow-sm"
                    style={{ backgroundColor: `hsl(${customPreview?.dark.background ?? "0 0% 8%"})` }}
                  />
                </div>
              </div>
              <div className="ml-auto flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground">{customColor.toUpperCase()}</span>
                <span className="text-[10px] text-muted-foreground">primary</span>
              </div>
            </div>
          </div>

          {/* Error message */}
          {customError && (
            <p className="text-xs text-destructive">
              <span className="font-semibold">!</span> {customError}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCustomPickerOpen(false)}
              className="font-mono text-xs"
            >
              cancel
            </Button>
            <Button onClick={handleConfirmCustom} className="font-mono text-xs">
              <Terminal className="mr-1.5 h-3 w-3" />
              apply_theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
