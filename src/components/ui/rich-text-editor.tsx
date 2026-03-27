import { useRef, useCallback } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { Loader2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  height?: number;
}

/**
 * Rich text editor component using TinyMCE.
 *
 * Provides WYSIWYG HTML editing for documentation article content.
 * Loads TinyMCE from CDN (self-hosted would need additional Vite config).
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  disabled = false,
  height = 400,
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);

  const handleInit = useCallback((_evt: any, editor: any) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <Editor
        tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js"
        onInit={handleInit}
        value={value}
        onEditorChange={(newValue) => onChange(newValue)}
        disabled={disabled}
        init={{
          height,
          menubar: "file edit view insert format tools table help",
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "image",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "fullscreen",
            "insertdatetime",
            "media",
            "table",
            "help",
            "wordcount",
            "codesample",
          ],
          toolbar:
            "undo redo | blocks | bold italic underline strikethrough | " +
            "forecolor backcolor | alignleft aligncenter alignright alignjustify | " +
            "bullist numlist outdent indent | link image media table codesample | " +
            "code fullscreen | removeformat help",
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #1a1a1a;
              padding: 12px;
            }
            pre {
              background-color: #f4f4f5;
              border-radius: 6px;
              padding: 12px;
              font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace;
              font-size: 13px;
            }
            code {
              background-color: #f4f4f5;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 13px;
            }
            pre code {
              background: none;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            table td, table th {
              border: 1px solid #e4e4e7;
              padding: 8px 12px;
            }
            table th {
              background-color: #f4f4f5;
              font-weight: 600;
            }
            blockquote {
              border-left: 4px solid #a1a1aa;
              margin: 16px 0;
              padding-left: 16px;
              color: #71717a;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            h1, h2, h3, h4, h5, h6 {
              font-weight: 600;
              letter-spacing: -0.025em;
            }
            h1 { font-size: 1.875rem; margin-bottom: 0.75rem; }
            h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
            h3 { font-size: 1.25rem; margin-bottom: 0.5rem; }
            h4 { font-size: 1.125rem; margin-bottom: 0.5rem; }
          `,
          placeholder,
          skin: "oxide",
          content_css: "default",
          resize: true,
          statusbar: true,
          elementpath: false,
          branding: false,
          promotion: false,
          // Dark mode support via media query detection
          content_css_cors: true,
          // Table defaults
          table_default_styles: {
            width: "100%",
          },
          // Image defaults
          image_dimensions: false,
          image_class_list: [{ title: "Responsive", value: "img-responsive" }],
          // Link defaults
          link_default_target: "_blank",
          // Codesample languages
          codesample_languages: [
            { text: "HTML/XML", value: "markup" },
            { text: "JavaScript", value: "javascript" },
            { text: "TypeScript", value: "typescript" },
            { text: "CSS", value: "css" },
            { text: "Python", value: "python" },
            { text: "Bash", value: "bash" },
            { text: "JSON", value: "json" },
            { text: "SQL", value: "sql" },
          ],
          // Setup dark mode detection
          setup: (editor: any) => {
            editor.on("init", () => {
              const isDark = document.documentElement.classList.contains("dark");
              if (isDark) {
                editor.getDoc().documentElement.classList.add("dark");
                editor.dom.addStyle(`
                  body { background-color: #18181b; color: #e4e4e7; }
                  pre { background-color: #27272a; }
                  code { background-color: #27272a; }
                  table td, table th { border-color: #3f3f46; }
                  table th { background-color: #27272a; }
                  blockquote { color: #a1a1aa; border-color: #52525b; }
                `);
              }
            });
          },
        }}
      />
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
