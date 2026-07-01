const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  const supabasePublicKey = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !supabasePublicKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing public Supabase environment variables." }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: supabasePublicKey,
    }),
  };
};
