export interface PlannerTask {
  id: string;
  title: string;
  description?: string;
  cat: "work" | "meet" | "focus" | "life";
  date: string | null;
  endDate?: string | null;
  allDay: boolean;
  start?: number | null;
  dur?: number | null;
  prio: "high" | "med" | "low";
  reason: string;
  source: string;
  phase?: string | null;
  isMilestone?: boolean;
  isReminder?: boolean;
  dependsOn?: string[];
  recurrence?: Record<string, unknown> | null;
  condition?: string | null;
  // review workflow state
  _reviewStatus?: "pending" | "accepted" | "rejected";
}

export interface StagedFile {
  name: string;
  kind: string;
  size: string;
  items: number;
}

export type ViewMode = "day" | "week" | "month";
export type Screen = "calendar" | "upload" | "extracting";

export interface PlannerState {
  screen: Screen;
  files: StagedFile[];
  rawFiles: File[];
  tasks: PlannerTask[];
  sources: StagedFile[];
  view: ViewMode;
}
