-- ICECONNECT workforce identity on User (EmployeeSystem, domain, hierarchy).

CREATE TYPE "EmployeeSystem" AS ENUM ('BGOS', 'ICECONNECT');
CREATE TYPE "EmployeeDomain" AS ENUM ('BGOS', 'SOLAR');
CREATE TYPE "IceconnectEmployeeRole" AS ENUM ('RSM', 'BDM', 'BDE', 'TECH_EXEC');

ALTER TABLE "User" ADD COLUMN "employeeSystem" "EmployeeSystem";
ALTER TABLE "User" ADD COLUMN "employeeDomain" "EmployeeDomain";
ALTER TABLE "User" ADD COLUMN "iceconnectEmployeeRole" "IceconnectEmployeeRole";
ALTER TABLE "User" ADD COLUMN "parentId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_parentId_idx" ON "User"("parentId");
CREATE INDEX "User_employeeSystem_iceconnectEmployeeRole_idx" ON "User"("employeeSystem", "iceconnectEmployeeRole");
