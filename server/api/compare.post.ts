import { defineEventHandler, readBody, createError } from "h3";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { target, attempt } = body;

  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Using simulated logic.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      score: 85,
      explanation: "GEMINI_API_KEY missing. This is a simulated score.",
    };
  }

  if (!target || !attempt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Both images are required",
    });
  }

  try {
    // Define the schema for structured output
    const schema = {
      description: "Scavenger hunt match evaluation",
      type: SchemaType.OBJECT,
      properties: {
        score: {
          type: SchemaType.NUMBER,
          description: "Match accuracy score from 0 to 100",
          nullable: false,
        },
        explanation: {
          type: SchemaType.STRING,
          description: "A brief 1-sentence explanation of the score",
          nullable: false,
        },
      },
      required: ["score", "explanation"],
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // Helper to format base64 for Gemini
    const formatImage = (dataUrl: string) => {
      const base64 = dataUrl.split(",")[1];
      const mimeType = dataUrl.split(";")[0].split(":")[1];
      return {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      };
    };

    const prompt = `
      Compare these two photos for a "Scavenger Hunt" game. 
      Photo 1 is the target reference. 
      Photo 2 is the user's attempt to match it.

      GOAL: Rate how closely the photographer matched the location, camera angle, and perspective.
      IGNORE: Lighting, weather, seasons, and temporary objects (people, cars).
      FOCUS: Landmarks, building angles, foreground/background relationships.
    `;

    const result = await model.generateContent([
      prompt,
      formatImage(target),
      formatImage(attempt),
    ]);

    const response = await result.response;
    const text = response.text();

    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Vision API failed: " + error.message,
    });
  }
});
