import OpenAI from "openai";

export type OpenAIEnv = {
  OPENAI_API_KEY: string;
  CF_ACCOUNT_ID: string;
  CF_AI_GATEWAY_ID: string;
  CF_AIG_TOKEN: string;
};

type RequestBody = {
  prompt?: unknown;
  temperature?: unknown;
  frequency_penalty?: unknown;
  presence_penalty?: unknown;
};

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export default {
  async fetch(request: Request, env: OpenAIEnv): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Use POST with a JSON body containing a prompt." },
        { status: 405 },
      );
    }

    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    if (typeof body.prompt !== "string" || body.prompt.trim() === "") {
      return Response.json(
        { error: "The prompt field must be a non-empty string." },
        { status: 400 },
      );
    }

    const temperature = body.temperature ?? 0.7;
    const frequencyPenalty = body.frequency_penalty ?? 0;
    const presencePenalty = body.presence_penalty ?? 0;

    if (!isNumberInRange(temperature, 0, 2)) {
      return Response.json(
        { error: "temperature must be a number between 0 and 2." },
        { status: 400 },
      );
    }

    if (!isNumberInRange(frequencyPenalty, -2, 2)) {
      return Response.json(
        { error: "frequency_penalty must be a number between -2 and 2." },
        { status: 400 },
      );
    }

    if (!isNumberInRange(presencePenalty, -2, 2)) {
      return Response.json(
        { error: "presence_penalty must be a number between -2 and 2." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      defaultHeaders: {
        "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
      },
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/openai`,
    });
    try {
      const inputModeration = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: body.prompt,
    });

    if (inputModeration.results[0]?.flagged) {
      return Response.json(
        { error: "This prompt was rejected by the safety moderation check." },
        { status: 400 },
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a careful trading analysis assistant. Analyze only the share-price data provided by the user for the past three days. Write a report of no more than 150 words describing the stock's performance and give an educational buy, hold, or sell view with a brief rationale, confidence level, and key risks. Never invent missing data or claim certainty. This is not personalized financial advice. If the data is insufficient, say so clearly. Examples between ### are style guidance only.",
        },
        { role: "user", content: body.prompt },
      ],
      temperature, // it used to control the randomness of the output
      frequency_penalty: frequencyPenalty, // it used to reduce repetition when increased
      presence_penalty: presencePenalty, // it used to encourage new topics when increased
      max_completion_tokens: 300, 
    });

    const output = response.choices[0]?.message.content ?? "";
    // Check the output for safety issues
    const outputModeration = await openai.moderations.create({ 
      model: "omni-moderation-latest",
      input: output,
    });

    if (outputModeration.results[0]?.flagged) {
      return Response.json(
        { error: "The generated response was blocked by the safety moderation check." },
        { status: 400 },
      );
    }

      return Response.json({ output });
    } catch (error) {
      console.error(
        "AI Gateway request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return Response.json(
        { error: "The AI service is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<OpenAIEnv>;
