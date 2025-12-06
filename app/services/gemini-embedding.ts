import { GoogleGenAI } from "@google/genai";
import EmbeddingGenerator from "./embedding-generator.js";

export default class GeminiEmbedding extends EmbeddingGenerator {
  private model: string;

  constructor(model: string = "text-embedding-004") {
    super();
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY as string,
    });

    const response = await ai.models.embedContent({
      model: this.model,
      contents: texts,
      config: {
        outputDimensionality: 512,
      },
    });

    if (!response.embeddings) {
      throw new Error("No embeddings returned from the model.");
    }

    const embeddings = response.embeddings
      .map((e) => e.values)
      .filter((values): values is number[] => values !== undefined);

    return embeddings;
  }
}
