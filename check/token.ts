async function getToken(): Promise<string> {
  const res = await fetch(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.CDSE_CLIENT_ID!,
        client_secret: process.env.CDSE_CLIENT_SECRET!,
      }),
    },
  );
  if (!res.ok) throw new Error(`Token-haku epäonnistui: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  console.log("token ok, alku:", data.access_token.slice(0, 12) + "...", "voimassa (s):", data.expires_in);
  return data.access_token;
}

getToken().catch(console.error);