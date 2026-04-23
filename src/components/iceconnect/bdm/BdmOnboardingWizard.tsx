"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type EmployeeRow = {
  name: string;
  role: string;
  department: string;
  responsibilities: string;
  featuresNeeded: string[];
  customFeature: string;
};

type WizardLead = {
  id: string;
  companyName: string;
  industry: string | null;
};

type Props = {
  lead: WizardLead;
  onClose: () => void;
  onSubmitted: () => void;
};

const FEATURE_OPTIONS = [
  "Lead tracking",
  "Task management",
  "Attendance",
  "Sales pipeline",
  "Inventory",
  "Reports",
  "Customer management",
  "Custom",
];

const prefillSuggestionsByIndustry: Record<string, EmployeeRow[]> = {
  solar: [
    {
      name: "",
      role: "Sales Executive",
      department: "Sales",
      responsibilities: "Lead follow-up and conversion",
      featuresNeeded: ["Lead tracking", "Sales pipeline"],
      customFeature: "",
    },
    {
      name: "",
      role: "Site Engineer",
      department: "Operations",
      responsibilities: "Site assessments and planning",
      featuresNeeded: ["Task management", "Reports"],
      customFeature: "",
    },
    {
      name: "",
      role: "Installation Team",
      department: "Operations",
      responsibilities: "Installation execution and completion",
      featuresNeeded: ["Task management", "Attendance"],
      customFeature: "",
    },
    {
      name: "",
      role: "Accountant",
      department: "Finance",
      responsibilities: "Collections and invoice tracking",
      featuresNeeded: ["Reports", "Customer management"],
      customFeature: "",
    },
  ],
};

function emptyEmployee(): EmployeeRow {
  return {
    name: "",
    role: "",
    department: "",
    responsibilities: "",
    featuresNeeded: [],
    customFeature: "",
  };
}

function buildEstimate(employeeCount: number) {
  if (employeeCount <= 5) return "Simple (1-5 employees): 1-2 days";
  if (employeeCount <= 15) return "Medium (6-15 employees): 3-5 days";
  return "Complex (15+ employees): 1-2 weeks";
}

export function BdmOnboardingWizard({ lead, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyProfile, setCompanyProfile] = useState({
    companyName: lead.companyName,
    industry: lead.industry ?? "Solar",
    companySize: "1-5",
    businessDescription: "",
    currentTools: "",
    mainChallenges: "",
    goals6Months: "",
    monthlyRevenueRange: "",
  });

  const [bossDetails, setBossDetails] = useState({
    bossName: "",
    bossEmail: "",
    bossPhone: "",
    preferredLanguage: "English",
    heardFrom: "",
  });

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [submitForm, setSubmitForm] = useState({
    priority: "Normal",
    specialNotes: "",
    estimatedDelivery: "",
  });

  const estimatedComplexity = useMemo(() => buildEstimate(employees.length), [employees.length]);
  const calculatedEstimatedDelivery = useMemo(() => {
    const today = new Date();
    const days = employees.length <= 5 ? 2 : employees.length <= 15 ? 5 : 14;
    const target = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return target.toISOString().slice(0, 10);
  }, [employees.length]);

  async function submitToSde() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/bdm/tech-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          companyName: companyProfile.companyName,
          industry: companyProfile.industry,
          employeeCount: employees.length,
          employees: employees.map((employee) => ({
            name: employee.name,
            role: employee.role,
            department: employee.department,
            responsibilities: employee.responsibilities,
            featuresNeeded:
              employee.featuresNeeded.includes("Custom") && employee.customFeature
                ? [...employee.featuresNeeded.filter((f) => f !== "Custom"), `Custom: ${employee.customFeature}`]
                : employee.featuresNeeded,
          })),
          priority: submitForm.priority,
          notes: submitForm.specialNotes,
          estimatedDelivery: submitForm.estimatedDelivery || calculatedEstimatedDelivery,
          type: "ONBOARDING",
          companyProfile,
          bossDetails,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not submit request.");
        return;
      }
      onSubmitted();
    } catch {
      setError("Could not submit request.");
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    if (step === 1) {
      return (
        <div style={panelStyle}>
          <h4 style={titleStyle}>Step 1 — Company Profile</h4>
          <Field label="Company name">
            <input style={inputStyle} value={companyProfile.companyName} onChange={(e) => setCompanyProfile((s) => ({ ...s, companyName: e.target.value }))} />
          </Field>
          <Field label="Industry">
            <input style={inputStyle} value={companyProfile.industry} onChange={(e) => setCompanyProfile((s) => ({ ...s, industry: e.target.value }))} />
          </Field>
          <Field label="Company size">
            <select style={inputStyle} value={companyProfile.companySize} onChange={(e) => setCompanyProfile((s) => ({ ...s, companySize: e.target.value }))}>
              <option>1-5</option>
              <option>6-20</option>
              <option>21-50</option>
              <option>50+</option>
            </select>
          </Field>
          <Field label="Business description"><textarea style={textareaStyle} value={companyProfile.businessDescription} onChange={(e) => setCompanyProfile((s) => ({ ...s, businessDescription: e.target.value }))} /></Field>
          <Field label="Current tools they use"><textarea style={textareaStyle} value={companyProfile.currentTools} onChange={(e) => setCompanyProfile((s) => ({ ...s, currentTools: e.target.value }))} /></Field>
          <Field label="Main challenges"><textarea style={textareaStyle} value={companyProfile.mainChallenges} onChange={(e) => setCompanyProfile((s) => ({ ...s, mainChallenges: e.target.value }))} /></Field>
          <Field label="Goals for next 6 months"><textarea style={textareaStyle} value={companyProfile.goals6Months} onChange={(e) => setCompanyProfile((s) => ({ ...s, goals6Months: e.target.value }))} /></Field>
          <Field label="Monthly revenue range (optional)"><input style={inputStyle} value={companyProfile.monthlyRevenueRange} onChange={(e) => setCompanyProfile((s) => ({ ...s, monthlyRevenueRange: e.target.value }))} /></Field>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div style={panelStyle}>
          <h4 style={titleStyle}>Step 2 — Owner/Boss Details</h4>
          <Field label="Boss full name"><input style={inputStyle} value={bossDetails.bossName} onChange={(e) => setBossDetails((s) => ({ ...s, bossName: e.target.value }))} /></Field>
          <Field label="Boss email"><input style={inputStyle} value={bossDetails.bossEmail} onChange={(e) => setBossDetails((s) => ({ ...s, bossEmail: e.target.value }))} /></Field>
          <Field label="Boss phone"><input style={inputStyle} value={bossDetails.bossPhone} onChange={(e) => setBossDetails((s) => ({ ...s, bossPhone: e.target.value }))} /></Field>
          <Field label="Preferred dashboard language"><input style={inputStyle} value={bossDetails.preferredLanguage} onChange={(e) => setBossDetails((s) => ({ ...s, preferredLanguage: e.target.value }))} /></Field>
          <Field label="How did they hear about BGOS"><input style={inputStyle} value={bossDetails.heardFrom} onChange={(e) => setBossDetails((s) => ({ ...s, heardFrom: e.target.value }))} /></Field>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div style={panelStyle}>
          <h4 style={titleStyle}>Step 3 — Employee Collection</h4>
          <button type="button" style={buttonStyle} onClick={() => setEmployees((rows) => [...rows, emptyEmployee()])}>
            Add Employee
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{employees.length} employees added</p>

          <div style={{ ...panelStyle, marginTop: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#9CE7FF", fontWeight: 700 }}>NEXA SUGGESTION</p>
            <p style={{ margin: "6px 0 0", fontSize: 13 }}>
              For a Solar company, typical roles are: Sales Executive, Site Engineer, Installation Team, Accountant. Want me to pre-fill these?
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  const key = companyProfile.industry.trim().toLowerCase();
                  const rows = prefillSuggestionsByIndustry[key] ?? prefillSuggestionsByIndustry.solar;
                  setEmployees(rows.map((row) => ({ ...row })));
                }}
              >
                Yes, pre-fill
              </button>
              <button type="button" style={buttonStyle} onClick={() => setEmployees([])}>
                No, I&apos;ll add manually
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {employees.map((row, idx) => (
              <div key={`row-${idx}`} style={{ ...panelStyle, borderColor: "rgba(255,255,255,0.14)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Employee #{idx + 1}</p>
                <Field label="Full name">
                  <input style={inputStyle} value={row.name} onChange={(e) => setEmployees((all) => all.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                </Field>
                <Field label="Role/Position">
                  <input style={inputStyle} value={row.role} onChange={(e) => setEmployees((all) => all.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)))} />
                </Field>
                <Field label="Department">
                  <input style={inputStyle} value={row.department} onChange={(e) => setEmployees((all) => all.map((x, i) => (i === idx ? { ...x, department: e.target.value } : x)))} />
                </Field>
                <Field label="Main responsibilities">
                  <textarea style={textareaStyle} value={row.responsibilities} onChange={(e) => setEmployees((all) => all.map((x, i) => (i === idx ? { ...x, responsibilities: e.target.value } : x)))} />
                </Field>
                <Field label="Dashboard features needed">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6 }}>
                    {FEATURE_OPTIONS.map((opt) => (
                      <label key={opt} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.featuresNeeded.includes(opt)}
                          onChange={(e) =>
                            setEmployees((all) =>
                              all.map((x, i) =>
                                i !== idx
                                  ? x
                                  : {
                                      ...x,
                                      featuresNeeded: e.target.checked
                                        ? [...x.featuresNeeded, opt]
                                        : x.featuresNeeded.filter((f) => f !== opt),
                                    },
                              ),
                            )
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                  {row.featuresNeeded.includes("Custom") ? (
                    <input
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder="Describe custom feature"
                      value={row.customFeature}
                      onChange={(e) => setEmployees((all) => all.map((x, i) => (i === idx ? { ...x, customFeature: e.target.value } : x)))}
                    />
                  ) : null}
                </Field>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div style={panelStyle}>
          <h4 style={titleStyle}>Step 4 — Requirements Summary</h4>
          <p><strong>Company:</strong> {companyProfile.companyName}</p>
          <p><strong>Industry:</strong> {companyProfile.industry}</p>
          <p><strong>Size:</strong> {companyProfile.companySize}</p>
          <p><strong>Goals:</strong> {companyProfile.goals6Months || "—"}</p>
          <p><strong>Employees collected:</strong> {employees.length}</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thTdStyle}>Name</th>
                  <th style={thTdStyle}>Role</th>
                  <th style={thTdStyle}>Department</th>
                  <th style={thTdStyle}>Features</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, idx) => (
                  <tr key={`emp-${idx}`}>
                    <td style={thTdStyle}>{employee.name || "—"}</td>
                    <td style={thTdStyle}>{employee.role || "—"}</td>
                    <td style={thTdStyle}>{employee.department || "—"}</td>
                    <td style={thTdStyle}>{employee.featuresNeeded.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 10 }}><strong>Estimated build complexity:</strong> {estimatedComplexity}</p>
        </div>
      );
    }

    return (
      <div style={panelStyle}>
        <h4 style={titleStyle}>Step 5 — Submit Tech Request</h4>
        <div style={{ ...panelStyle, borderColor: "rgba(79,209,255,0.3)" }}>
          <p><strong>Company:</strong> {companyProfile.companyName}</p>
          <p><strong>Employees:</strong> {employees.length} dashboards needed</p>
          <p><strong>Industry:</strong> {companyProfile.industry}</p>
        </div>
        <Field label="Priority">
          <select style={inputStyle} value={submitForm.priority} onChange={(e) => setSubmitForm((s) => ({ ...s, priority: e.target.value }))}>
            <option>Normal</option>
            <option>Urgent</option>
          </select>
        </Field>
        <Field label="Special notes for SDE">
          <textarea style={textareaStyle} value={submitForm.specialNotes} onChange={(e) => setSubmitForm((s) => ({ ...s, specialNotes: e.target.value }))} />
        </Field>
        <Field label="Estimated delivery">
          <input style={inputStyle} type="date" value={submitForm.estimatedDelivery || calculatedEstimatedDelivery} onChange={(e) => setSubmitForm((s) => ({ ...s, estimatedDelivery: e.target.value }))} />
        </Field>
        {error ? <p style={{ color: "#FCA5A5", margin: 0 }}>{error}</p> : null}
        <button type="button" style={primaryButtonStyle} disabled={saving} onClick={() => void submitToSde()}>
          {saving ? "Submitting..." : "Submit to SDE"}
        </button>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={wizardShellStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 19 }}>Franchise Onboarding Wizard</h3>
          <button type="button" style={buttonStyle} onClick={onClose}>Close</button>
        </div>
        <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Step {step} of 5</p>
        {renderStep()}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button type="button" style={buttonStyle} disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Back
          </button>
          <button type="button" style={buttonStyle} disabled={step === 5} onClick={() => setStep((s) => Math.min(5, s + 1))}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
      {label}
      {children}
    </label>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.68)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
  zIndex: 80,
};

const wizardShellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 920,
  maxHeight: "90vh",
  overflow: "auto",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0F172A",
  padding: 16,
  display: "grid",
  gap: 10,
};

const panelStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
  display: "grid",
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 70,
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid rgba(79,209,255,0.5)",
  background: "rgba(79,209,255,0.14)",
  color: "#9CE7FF",
};

const thTdStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  padding: "6px 8px",
  textAlign: "left",
};
