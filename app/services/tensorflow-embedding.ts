import use from "@tensorflow-models/universal-sentence-encoder";
import tf from "@tensorflow/tfjs-node";

import EmbeddingGenerator from "./embedding-generator.js";

export default class TensorflowEmbedding extends EmbeddingGenerator {
    private model: any;
    constructor() {
        super();
    }   
    async generate(texts: string[]): Promise<number[][]> {
        this.model = await use.load();
        const batchSize = 32;
        const embeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batchTexts = texts.slice(i, i + batchSize);
            const embeddingsTensor = await this.model.embed(batchTexts);
            const batchEmbeddings = await embeddingsTensor.array() as number[][];
            embeddings.push(...batchEmbeddings);
            embeddingsTensor.dispose();
        }

        return embeddings;
    }
}