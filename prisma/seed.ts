import {
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  DealStatus,
  InternalCallStatus,
  InternalSalesStage,
  LeadStatus,
  PaymentStatus,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import { applySolarTemplate } from "../src/lib/industry-templates";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";
import { companyMembershipClass } from "../src/lib/user-company";

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.onboardingMessage.deleteMany();
  await prisma.onboardingSubmissionTechTask.deleteMany();
  await prisma.onboardingSubmission.deleteMany();
  await prisma.onboardingFormTemplate.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.serviceTicket.deleteMany();
  await prisma.installation.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.userCompany.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await hashPassword("demo-password-change-me");

  const boss = await prisma.user.create({
    data: {
      name: "Boss User",
      mobile: "9999999999",
      email: "boss@iceconnect.demo",
      password: passwordHash,
      workspaceActivatedAt: new Date(),
    },
  });

  const company = await prisma.company.create({
    data: {
      name: "ICECONNECT Solar Demo",
      plan: CompanyPlan.PRO,
      ownerId: boss.id,
      industry: CompanyIndustry.SOLAR,
      logoUrl: "/bgos-logo-placeholder.svg",
      primaryColor: "#DC2626",
      secondaryColor: "#EAB308",
    },
  });

  await prisma.userCompany.create({
    data: {
      userId: boss.id,
      companyId: company.id,
      role: companyMembershipClass(UserRole.ADMIN),
      jobRole: UserRole.ADMIN,
    },
  });

  await applySolarTemplate(company.id);

  async function member(
    name: string,
    mobile: string,
    email: string,
    jobRole: UserRole,
  ) {
    const u = await prisma.user.create({
      data: {
        name,
        mobile,
        email,
        password: passwordHash,
        workspaceActivatedAt: new Date(),
      },
    });
    await prisma.userCompany.create({
      data: {
        userId: u.id,
        companyId: company.id,
        role: companyMembershipClass(jobRole),
        jobRole,
      },
    });
    return u;
  }

  const telecaller = await member("Sales TC", "9111111111", "telecaller@iceconnect.demo", UserRole.TELECALLER);

  const internalCompany = await prisma.company.create({
    data: {
      name: "BGOS Internal",
      plan: CompanyPlan.ENTERPRISE,
      ownerId: boss.id,
      industry: CompanyIndustry.SOLAR,
      subscriptionStatus: CompanySubscriptionStatus.ACTIVE,
      isTrialActive: false,
      internalSalesOrg: true,
      internalSalesDefaultAssigneeId: telecaller.id,
    },
  });
  await prisma.userCompany.create({
    data: {
      userId: boss.id,
      companyId: internalCompany.id,
      role: companyMembershipClass(UserRole.MANAGER),
      jobRole: UserRole.MANAGER,
    },
  });
  await prisma.userCompany.create({
    data: {
      userId: telecaller.id,
      companyId: internalCompany.id,
      role: companyMembershipClass(UserRole.SALES_EXECUTIVE),
      jobRole: UserRole.SALES_EXECUTIVE,
    },
  });

  const engineer = await member("Field Engineer", "9222222222", "engineer@iceconnect.demo", UserRole.SITE_ENGINEER);
  await prisma.userCompany.create({
    data: {
      userId: engineer.id,
      companyId: internalCompany.id,
      role: companyMembershipClass(UserRole.SITE_ENGINEER),
      jobRole: UserRole.SITE_ENGINEER,
    },
  });
  const installer = await member("Lead Installer", "9333333333", "installer@iceconnect.demo", UserRole.INSTALLATION_TEAM);
  const accounts = await member("Accounts", "9444444444", "accounts@iceconnect.demo", UserRole.ACCOUNTANT);
  const service = await member("Service Desk", "9555555555", "service@iceconnect.demo", UserRole.SERVICE_TEAM);

  await prisma.lead.create({
    data: {
      name: "Internal demo lead",
      phone: "9000000001",
      status: LeadStatus.NEW,
      companyId: internalCompany.id,
      createdByUserId: boss.id,
      assignedTo: telecaller.id,
      source: "seed",
      leadCompanyName: "Demo Biz",
      businessType: "Solar",
      internalSalesStage: InternalSalesStage.LEAD_ADDED,
      internalCallStatus: InternalCallStatus.NOT_CALLED,
    },
  });

  const leadsCreated = await prisma.$transaction([
    prisma.lead.create({
      data: {
        name: "Ravi",
        phone: "8888888888",
        status: LeadStatus.NEW,
        value: 100000,
        companyId: company.id,
        createdByUserId: boss.id,
        assignedTo: telecaller.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: "Arun",
        phone: "7777777777",
        status: LeadStatus.QUALIFIED,
        value: 200000,
        companyId: company.id,
        createdByUserId: boss.id,
        assignedTo: telecaller.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: "John",
        phone: "7666666666",
        status: LeadStatus.PROPOSAL_SENT,
        value: 300000,
        companyId: company.id,
        createdByUserId: boss.id,
        assignedTo: telecaller.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: "Site Visit Lead",
        phone: "7444444444",
        status: LeadStatus.SITE_VISIT_SCHEDULED,
        value: 180000,
        companyId: company.id,
        createdByUserId: boss.id,
        assignedTo: engineer.id,
      },
    }),
  ]);
  const ravi = leadsCreated[0];
  const arun = leadsCreated[1];

  await prisma.deal.createMany({
    data: [
      { leadId: ravi.id, companyId: company.id, value: 250000, status: DealStatus.WON },
      { leadId: arun.id, companyId: company.id, value: 150000, status: DealStatus.LOST },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Follow up lead",
        status: TaskStatus.PENDING,
        userId: telecaller.id,
        leadId: ravi.id,
        companyId: company.id,
        priority: 6,
      },
      {
        title: "Send proposal",
        status: TaskStatus.COMPLETED,
        userId: telecaller.id,
        leadId: arun.id,
        companyId: company.id,
        priority: 5,
      },
    ],
  });

  await prisma.installation.createMany({
    data: [
      {
        status: "Completed",
        companyId: company.id,
        assignedTo: installer.id,
      },
      {
        status: "Scheduled",
        companyId: company.id,
        assignedTo: installer.id,
        scheduledDate: new Date(Date.now() + 86400000 * 2),
      },
    ],
  });

  await prisma.serviceTicket.createMany({
    data: [
      {
        title: "Inverter fault reported",
        description: "Customer reports error code E12",
        companyId: company.id,
        assignedTo: null,
      },
      {
        title: "Warranty follow-up",
        companyId: company.id,
        assignedTo: service.id,
      },
    ],
  });

  await prisma.payment.createMany({
    data: [
      { amount: 500000, status: PaymentStatus.PAID, companyId: company.id },
      { amount: 200000, status: PaymentStatus.PENDING, companyId: company.id },
    ],
  });

  await prisma.activityLog.create({
    data: {
      type: "SEED",
      message: "Demo data loaded for BGOS + ICECONNECT",
      companyId: company.id,
      userId: boss.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
