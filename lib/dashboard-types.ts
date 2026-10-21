export type AttendanceTrafficDay = {
  date: string;
  entries: number;
  exits: number;
  total: number;
};

export type DashboardSummary = {
  period: string;
  generatedAt: string;
  activeEmployees: number;
  attendanceEvents: number;
  activeSites: number;
  activeTerminals: number;
  attendanceTraffic: {
    startDate: string;
    endDate: string;
    days: AttendanceTrafficDay[];
  };
};
