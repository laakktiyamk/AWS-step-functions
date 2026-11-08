import { sendEmail } from "../shared/services/emailService";

export const handler = async () => {
  try {
    await sendEmail(
      "laakkti.yamk@outlook.com",
      "SES-testi Lambdasta",
      "Jos näet tämän, SES toimii Lambdasta."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err: any) {
    console.error("SES-virhe:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.name, message: err.message }),
    };
  }
};