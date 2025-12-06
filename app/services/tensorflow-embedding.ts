import { load } from "@tensorflow-models/universal-sentence-encoder";

import EmbeddingGenerator from "./embedding-generator.js";

export default class TensorflowEmbedding extends EmbeddingGenerator {
  constructor() {
    super();
  }

  async generate(texts: string[]): Promise<number[][]> {
    const model = await load();
    const batchSize = 32;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);
      const embeddingsTensor = await model.embed(batchTexts);
      const batchEmbeddings = await embeddingsTensor.array();
      embeddings.push(...batchEmbeddings);
      embeddingsTensor.dispose();
    }

    return embeddings;
  }
}
