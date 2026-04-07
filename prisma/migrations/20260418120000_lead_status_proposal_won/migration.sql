-- Add CRM stage after quotation approval (booked, awaiting payment).

ALTER TYPE "LeadStatus" ADD VALUE 'PROPOSAL_WON';
