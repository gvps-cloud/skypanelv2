import React, { useState, useEffect, useCallback } from "react";
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const API_KEY_STORAGE_KEY = "skypanel_api_docs_key";
const API_KEY_PREFIX = "sk_live_";

interface ApiKeyInputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onValidate: (key: string) => Promise<{ valid: boolean; error?: string }>;
}

export function ApiKeyInput({ apiKey, onApiKeyChange, onValidate }: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey && storedKey.startsWith(API_KEY_PREFIX)) {
      onApiKeyChange(storedKey);
    }
  }, [onApiKeyChange]);

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onApiKeyChange(value);
    setValidationStatus("idle");
    setValidationError(null);
  }, [onApiKeyChange]);

  const handleTestConnection = useCallback(async () => {
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
      setValidationStatus("invalid");
      setValidationError("Invalid API key format. Must start with sk_live_");
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await onValidate(apiKey);
      if (result.valid) {
        setValidationStatus("valid");
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      } else {
        setValidationStatus("invalid");
        setValidationError(result.error || "Invalid API key");
      }
    } catch (error) {
      setValidationStatus("invalid");
      setValidationError(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setIsValidating(false);
    }
  }, [apiKey, onValidate]);

  const handleClearKey = useCallback(() => {
    onApiKeyChange("");
    setValidationStatus("idle");
    setValidationError(null);
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }, [onApiKeyChange]);

  const handleToggleVisibility = useCallback(() => {
    setShowKey((prev) => !prev);
  }, []);

  const getStatusBadge = () => {
    if (validationStatus === "valid") {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      );
    }
    if (validationStatus === "invalid") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Invalid
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">API Key</span>
        {getStatusBadge()}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="sk_live_..."
            value={apiKey}
            onChange={handleKeyChange}
            className="pr-10 font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={handleToggleVisibility}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={!apiKey || isValidating}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Test"
          )}
        </Button>

        {apiKey && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearKey}
            title="Clear API key"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {validationError && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{validationError}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Enter your API key to test endpoints directly. Keys are stored locally in your browser.
        <span className="block mt-1 text-amber-600 dark:text-amber-500">
          ⚠️ Never share your API key. Only use keys in trusted environments.
        </span>
      </p>
    </div>
  );
}

export { API_KEY_STORAGE_KEY, API_KEY_PREFIX };
