export interface AttendanceRecord {
  date: string;
  day: string;
  schIn: string;
  schOut: string;
  chkIn: string;
  chkOut: string;
  total: string;
  status: string;
}

export interface EmployeeInfo {
  id: string;
  name: string;
  designation: string;
  department: string;
}

export interface SearchResult {
  found: boolean;
  info?: EmployeeInfo;
  records?: AttendanceRecord[];
  monthName?: string;
  dateRange?: string;
  error?: string;
}

export interface FormData {
  empId: string;
  supId: string;
  otDutyDays: string;
  totalOtHours: string;
  totalHolidayDays: string;
  totalHolidayHours: string;
}

export interface AppConfig {
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    fontFamily: string;
  };
  content: {
    mainTitle: string;
    subTitle: string;
    searchPlaceholder: string;
    instructionTitle: string;
    instructionText1: string;
    instructionText2: string;
    footerNote: string;
    importantNoteTitle: string;
    successMessage: string;
  };
  api: {
    url: string;
  };
}

export const FONT_OPTIONS = [
  { label: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Monospace', value: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  { label: 'Modern Sans', value: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif' },
];