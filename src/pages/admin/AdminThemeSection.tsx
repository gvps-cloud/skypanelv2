import React, { useState } from "react";
import { Palette, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import type { ThemePreset } from "@/theme/presets";
import { DEFAULT_THEME_ID, generateCustomTheme } from "@/theme/presets";

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

  const isCustomActive = themeId === "custom";

  const handleOpenCustomPicker = () => {
    setCustomColor("#6366f1");
    setCustomError(null);
    setCustomPickerOpen(true);
  };

  const handleConfirmCustom = () => {
    const preset = generateCustomTheme(customColor);
    if (!preset) {
      setCustomError("Invalid color. Please enter a valid hex color.");
      return;
    }
    setCustomPickerOpen(false);
    onSelectPreset(preset);
  };

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3">
            Branding
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Theme Manager
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Choose a theme preset that updates instantly for all users
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Default preset: Mono (neutral monochrome palette). Use Red for red-accent highlights.
          </p>
          {!themeConfigLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last updated: {formattedThemeUpdatedAt}
            </p>
          )}
        </div>

        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Palette className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <div className="bg-card shadow sm:rounded-lg">
        <div className="border-b border px-6 py-4">
          <h3 className="text-lg font-medium text-foreground">Theme Presets</h3>
          <p className="text-sm text-muted-foreground">
            Apply a built-in palette for all users
          </p>
        </div>
        <div className="space-y-10 px-6 py-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Presets
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a built-in palette. Applying a preset changes the experience for every organization member.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                    className={`relative w-full rounded-lg border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isActive
                        ? "border-primary ring-2 ring-primary ring-opacity-20"
                        : "border-border hover:border-primary"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          {preset.label}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {preset.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isDefault && <Badge variant="secondary">Default</Badge>}
                        <Badge variant={isActive ? "default" : "outline"}>
                          {isSaving ? "Saving..." : isActive ? "Active" : "Preview"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-4">
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>Primary</span>
                        <span
                          className="h-10 w-10 rounded-md border shadow-sm"
                          style={{ backgroundColor: `hsl(${preset.light.primary})` }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>Surface</span>
                        <span
                          className="h-10 w-10 rounded-md border shadow-sm"
                          style={{ backgroundColor: `hsl(${preset.light.background})` }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>Dark Primary</span>
                        <span
                          className="h-10 w-10 rounded-md border shadow-sm"
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
                className={`relative w-full rounded-lg border-2 border-dashed p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isCustomActive
                    ? "border-primary ring-2 ring-primary ring-opacity-20"
                    : "border-border hover:border-primary"
                } ${savingPresetId !== null || themeConfigLoading ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Custom
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define your own brand palette
                    </p>
                  </div>
                  <Badge variant={isCustomActive ? "default" : "outline"}>
                    {savingPresetId === "custom" ? "Saving..." : isCustomActive ? "Active" : "Create"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-md border-2 border-dashed border-border"
                    style={{ backgroundColor: customColor }}
                  />
                  <span className="text-xs text-muted-foreground font-mono">
                    {customColor}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                  <Plus className="h-3 w-3" />
                  <span>Choose color</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom color picker dialog */}
      <Dialog open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Theme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Pick a primary brand color. Surface colors will use the default
              neutral palette so only accents change.
            </p>
            <div className="flex flex-col items-center gap-4">
              <HexColorPicker color={customColor} onChange={setCustomColor} />
              <div className="flex items-center gap-2">
                <Input
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setCustomError(null);
                  }}
                  className={`font-mono ${customError ? "border-destructive" : ""}`}
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
              {customError && (
                <p className="text-xs text-destructive">{customError}</p>
              )}
            </div>
            {/* Preview swatches */}
            <div className="flex gap-3 justify-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Light</span>
                <div
                  className="h-10 w-16 rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: `hsl(${generateCustomTheme(customColor)?.light.primary ?? "0 0 50%"})` }}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Dark</span>
                <div
                  className="h-10 w-16 rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: `hsl(${generateCustomTheme(customColor)?.dark.primary ?? "0 0 50%"})` }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCustomPickerOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmCustom}>Apply Custom Theme</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
