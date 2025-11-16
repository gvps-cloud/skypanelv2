import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StackScriptField {
  name: string;
  label?: string;
  allowed?: string[];
  oneof?: string[] | string;
  default?: any;
  example?: string;
}

interface StackScript {
  id: string;
  label: string;
  description?: string;
  user_defined_fields?: StackScriptField[];
  images?: string[];
}

interface LazyStackScriptConfigProps {
  selectedStackScript: StackScript | null;
  stackscriptData: Record<string, any>;
  onStackScriptDataChange: (data: Record<string, any>) => void;
  allowedImagesDisplay: string;
}

export default function LazyStackScriptConfig({
  selectedStackScript,
  stackscriptData,
  onStackScriptDataChange,
  allowedImagesDisplay
}: LazyStackScriptConfigProps) {
  // Memoize field processing to avoid recalculation
  const processedFields = useMemo(() => {
    if (!selectedStackScript?.user_defined_fields) return [];
    
    return selectedStackScript.user_defined_fields.map((field) => {
      const optionsArr = Array.isArray(field.allowed) 
        ? field.allowed 
        : Array.isArray(field.oneof) 
          ? field.oneof 
          : null;
      
      const rawOptions = !optionsArr && typeof field.oneof === 'string' 
        ? String(field.oneof).trim() 
        : '';
      
      const parsedOptions = rawOptions 
        ? rawOptions.split(/[|,]/).map((s: string) => s.trim()).filter(Boolean) 
        : [];
      
      const options = optionsArr || parsedOptions;
      const nameLower = String(field.name || '').toLowerCase();
      
      const inputType: 'text' | 'password' | 'email' = options && options.length > 0
        ? 'text'
        : nameLower.includes('password') || nameLower.includes('pass')
          ? 'password'
          : nameLower.includes('email')
            ? 'email'
            : 'text';

      return {
        ...field,
        options,
        inputType,
        value: stackscriptData[field.name] ?? ''
      };
    });
  }, [selectedStackScript?.user_defined_fields, stackscriptData]);

  if (!selectedStackScript || !processedFields.length) {
    return (
      <div className="p-4 border rounded-lg text-sm text-muted-foreground">
        Select a deployment that requires configuration to continue.
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, value: string) => {
    onStackScriptDataChange({
      ...stackscriptData,
      [fieldName]: value
    });
  };

  return (
    <div className="mt-6 p-4 border rounded-lg bg-muted/30 border">
      <h4 className="text-base font-medium text-foreground mb-3">
        Deployment Configuration
      </h4>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Allowed base images: {allowedImagesDisplay}
      </p>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-6">
          {processedFields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {field.label || field.name}
              </label>
              {field.options && field.options.length > 0 ? (
                <select
                  value={field.value}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 min-h-[48px] text-base rounded-md border bg-secondary text-foreground shadow-sm",
                    "focus:border-primary focus:ring-primary focus:outline-none focus:ring-2"
                  )}
                >
                  <option value="">Select</option>
                  {field.options.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.inputType}
                  value={field.value}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.example || field.default || ''}
                  className={cn(
                    "w-full px-4 py-3 min-h-[48px] border border rounded-md bg-secondary text-foreground",
                    "placeholder-gray-500 dark:placeholder-gray-400",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                  )}
                  autoComplete={field.inputType === 'password' ? 'new-password' : 'off'}
                />
              )}
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
