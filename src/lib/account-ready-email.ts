import "server-only";

type AccountReadyInput = {
  to: string;
  companyName: string;
  loginUrl: string;
  tempPassword: string;
};

/**
 * Production-safe placeholder for outbound email.
 * Integrate your SMTP/provider here; for now this is structured logging.
 */
export async function sendAccountReadyEmail(input: AccountReadyInput): Promise<void> {
  if (!input.to || !input.tempPassword) return;
  console.info("[email] Your BGOS Account is Ready", {
    to: input.to,
    subject: "Your BGOS Account is Ready",
    companyName: input.companyName,
    loginUrl: input.loginUrl,
  });
}
