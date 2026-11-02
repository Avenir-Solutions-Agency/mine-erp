/** Sends one indicator value to the ERP API with the agent token; returns a Hungarian status line. */
export async function postReading(
  api: string,
  token: string,
  kg: number,
): Promise<string> {
  try {
    const res = await fetch(`${api}/scale/readings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ kg }),
      signal: AbortSignal.timeout(1000),
    });
    return res.ok ? "kapcsolódva" : `API hiba ${res.status}`;
  } catch {
    return "az API nem érhető el";
  }
}
