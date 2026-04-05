import {
  CompanyPlan,
  DealStatus,
  LeadStatus,
  PaymentStatus,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.serviceTicket.deleteMany();
  await prisma.installation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "ICECONNECT Solar Demo",
      plan: CompanyPlan.PRO,
    },
  });

  const passwordHash = await hashPassword("demo-password-change-me");

  const boss = await prisma.user.create({
    data: {
      name: "Boss User",
      mobile: "9999999999",
      email: "boss@iceconnect.demo",
      password: passwordHash,
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  const [telecaller, engineer, installer, accounts, service] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Sales TC",
        mobile: "9111111111",
        email: "telecaller@iceconnect.demo",
        password: passwordHash,
        role: UserRole.TELECALLER,
        companyId: company.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "Field Engineer",
        mobile: "9222222222",
        email: "engineer@iceconnect.demo",
        password: passwordHash,
        role: UserRole.ENGINEER,
        companyId: company.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "Lead Installer",
        mobile: "9333333333",
        email: "installer@iceconnect.demo",
        password: passwordHash,
        role: UserRole.INSTALLER,
        companyId: company.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "Accounts",
        mobile: "9444444444",
        email: "accounts@iceconnect.demo",
        password: passwordHash,
        role: UserRole.ACCOUNTS,
        companyId: company.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "Service Desk",
        mobile: "9555555555",
        email: "service@iceconnect.demo",
        password: passwordHash,
        role: UserRole.SERVICE,
        companyId: company.id,
      },
    }),
  ]);

  const leadsCreated = await prisma.$transaction([
    prisma.lead.create({
      data: {
        name: "Ravi",
        phone: "8888888888",
        status: LeadStatus.NEW,
        value: 100000,
        companyId: company.id,
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
        assignedTo: telecaller.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: "John",
        phone: "7666666666",
        status: LeadStatus.PROPOSAL,
        value: 300000,
        companyId: company.id,
        assignedTo: telecaller.id,
      },
    }),
    prisma.lead.create({
      data: {
        name: "Site Visit Lead",
        phone: "7444444444",
        status: LeadStatus.VISIT,
        value: 180000,
        companyId: company.id,
        assignedTo: engineer.id,
      },
    }),
  ]);
  const ravi = leadsCreated[0];
  const arun = leadsCreated[1];

  await prisma.deal.createMany({
    data: [
      { leadId: ravi.id, value: 250000, status: DealStatus.WON },
      { leadId: arun.id, value: 150000, status: DealStatus.LOST },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Follow up lead",
        status: TaskStatus.PENDING,
        userId: telecaller.id,
        leadId: ravi.id,
      },
      {
        title: "Send proposal",
        status: TaskStatus.COMPLETED,
        userId: telecaller.id,
        leadId: arun.id,
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
