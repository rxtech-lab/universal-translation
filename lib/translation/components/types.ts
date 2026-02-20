import type { Term } from "../tools/term-tools";

/** Status of the editor */
export type EditorStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: Date }
  | { state: "translating"; current: number; total: number }
  | { state: "error"; message: string };

/** Props for the shared TranslationEditor wrapper */
export interface TranslationEditorProps {
  projectId: string;
  projectName: string;
  formatId: string;
  formatDisplayName: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  status: EditorStatus;
  errors?: string[];
  onClearErrors?: () => void;
  onTranslate: () => void;
  onStopTranslation?: () => void;
  onExport: () => void;
  onSave: () => void;
  children: React.ReactNode;
  terms: Term[];
  onTermsChange: (terms: Term[]) => void;
  onTranslationUpdated: (
    resourceId: string,
    entryId: string,
    targetText: string,
  ) => void;
  onClearAllTranslations: () => void;
  onRename?: (newName: string) => void;
}
