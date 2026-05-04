import { Edit2, FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VpsInstanceDetail } from "./types";

interface NotesTabProps {
  detail: VpsInstanceDetail | null;
  notesEditing: boolean;
  notesValue: string;
  notesSaving: boolean;
  onStartEditing: () => void;
  onNotesChange: (value: string) => void;
  onCancelEditing: () => void;
  onSave: () => void;
}

export default function NotesTab({
  detail,
  notesEditing,
  notesValue,
  notesSaving,
  onStartEditing,
  onNotesChange,
  onCancelEditing,
  onSave,
}: NotesTabProps) {
  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span>Notes</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Add personal notes about this server for your reference.
            </p>
          </div>
          {!notesEditing && (
            <Button variant="outline" size="sm" onClick={onStartEditing} className="gap-2">
              <Edit2 className="h-3.5 w-3.5" />
              {detail?.notes ? "Edit" : "Add Notes"}
            </Button>
          )}
        </div>
      </div>
      <div className="px-6 sm:px-8 py-6">
        {notesEditing ? (
          <div className="space-y-4">
            <Textarea
              value={notesValue}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Write your notes here... (e.g., server purpose, configuration details, reminders)"
              className="min-h-[150px] resize-y"
              disabled={notesSaving}
              maxLength={10000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {notesValue.length.toLocaleString()} / 10,000 characters
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onCancelEditing} disabled={notesSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} disabled={notesSaving} className="gap-2">
                  {notesSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Notes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : detail?.notes ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{detail.notes}</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notes yet. Click "Add Notes" to add some.</p>
          </div>
        )}
      </div>
    </section>
  );
}
