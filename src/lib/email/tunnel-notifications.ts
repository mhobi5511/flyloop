type TunnelNotification = {
  name: string;
  city: string;
  country: string;
  address: string | null;
  website: string | null;
  addedByName: string;
  addedByEmail: string | null;
  timestamp: string;
};

export async function sendNewTunnelNotification(details: TunnelNotification) {
  const subject = "New tunnel added on Flyloop";
  const body = [
    `Tunnel name: ${details.name}`,
    `City: ${details.city}`,
    `Country: ${details.country}`,
    `Address: ${details.address ?? "Not provided"}`,
    `Website: ${details.website ?? "Not provided"}`,
    `Added by: ${details.addedByName}`,
    `Added by email: ${details.addedByEmail ?? "Not provided"}`,
    `Timestamp: ${details.timestamp}`,
  ].join("\n");

  // TODO: Configure a server-side email provider such as Resend here.
  // Required recipient: marc.hobi@gmx.ch
  // Keep API keys in server-only environment variables, never in client code.
  console.info("New tunnel added on Flyloop", {
    to: "marc.hobi@gmx.ch",
    subject,
    body,
  });
}
