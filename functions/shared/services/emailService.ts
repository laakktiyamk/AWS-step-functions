import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({
  region: process.env.SES_REGION || "eu-north-1",
});

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const from = process.env.SES_FROM;
  if (!from) throw new Error("SES_FROM puuttuu ympäristömuuttujista");

  const result = await client.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            ...(html && { Html: { Data: html, Charset: "UTF-8" } }),
          },
        },
      },
    })
  );
  console.log("SES accepted message:", result.MessageId);
}