export type IndustryTemplate = {
  departments: string[];
  roles: Record<string, string[]>;
  roleFeatures: Record<string, string[]>;
  bossDashboardFeatures: string[];
};

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  SOLAR: {
    departments: ["Sales", "Site Survey", "Installation", "Accounts", "Customer Service"],
    roles: {
      Sales: ["Sales Manager", "Sales Executive", "Telecaller"],
      "Site Survey": ["Site Engineer"],
      Installation: ["Installation Team"],
      Accounts: ["Accountant"],
      "Customer Service": ["Service Team"],
    },
    roleFeatures: {
      "Sales Manager": ["Team performance overview", "Lead pipeline", "Daily targets", "Commission tracking", "Follow-up reminders"],
      "Sales Executive": ["Lead management", "Follow-up reminders", "Deal pipeline", "Daily targets", "Commission tracking"],
      Telecaller: ["Call logs", "Lead assignment", "Follow-up queue", "Daily call targets"],
      "Site Engineer": ["Site visit schedule", "Survey reports", "Photo upload", "Feasibility checklist"],
      "Installation Team": ["Installation schedule", "Completion checklist", "Material requirements", "Progress updates"],
      Accountant: ["Invoice management", "Payment tracking", "Expense recording", "Monthly reports"],
      "Service Team": ["Service tickets", "Customer complaints", "Resolution tracking"],
    },
    bossDashboardFeatures: [
      "Daily revenue summary",
      "Active installations today",
      "Pending site visits",
      "Sales pipeline overview",
      "Team attendance",
      "Customer complaints",
      "Inventory levels",
      "Expense summary",
    ],
  },
  ACADEMY: {
    departments: ["Admissions", "Faculty", "Administration", "Accounts"],
    roles: {
      Admissions: ["Admissions Manager", "Counselor"],
      Faculty: ["Teacher", "Trainer"],
      Administration: ["Admin Staff"],
      Accounts: ["Accountant"],
    },
    roleFeatures: {
      Counselor: ["Student inquiries", "Follow-up tracker", "Enrollment pipeline", "Daily targets"],
      Teacher: ["Class schedule", "Attendance marking", "Student progress", "Assignment tracking"],
      Accountant: ["Fee collection", "Payment tracking", "Expense recording", "Monthly reports"],
    },
    bossDashboardFeatures: ["Total enrollments", "Revenue this month", "Attendance overview", "Pending fee payments", "Staff performance"],
  },
  BUILDERS: {
    departments: ["Sales", "Projects", "Accounts", "Legal"],
    roles: {
      Sales: ["Sales Manager", "Sales Executive"],
      Projects: ["Project Manager", "Site Supervisor"],
      Accounts: ["Accountant"],
      Legal: ["Legal Manager"],
    },
    roleFeatures: {
      "Sales Executive": ["Property listings", "Client inquiries", "Site visit scheduling", "Deal pipeline"],
      "Project Manager": ["Project timeline", "Task management", "Contractor tracking", "Material management"],
    },
    bossDashboardFeatures: ["Active projects", "Sales pipeline", "Revenue overview", "Project timelines", "Payment collections"],
  },
  CUSTOM: {
    departments: [],
    roles: {},
    roleFeatures: {},
    bossDashboardFeatures: ["Revenue summary", "Team performance", "Task overview", "Customer management"],
  },
};

export function getTemplate(industry: string): IndustryTemplate {
  const key = industry.trim().toUpperCase();
  return INDUSTRY_TEMPLATES[key] ?? INDUSTRY_TEMPLATES.CUSTOM;
}
