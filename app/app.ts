import fastify from "fastify";
import TensorflowEmbedding from "./services/tensorflow-embedding.js";
import VectorDocumentStore from "./db/vector-document-store.js";

import { createTextChunks } from "./utils/utils.js";

export async function createApp() {
    const app = fastify();

    const embeddingGenerator = new TensorflowEmbedding();
    const vectorStore = new VectorDocumentStore({});
    await vectorStore.initialize();

    app.get("/health", async (request, reply) => {
        reply.send({ status: "OK", timestamp: new Date().toISOString() });
    });

    app.post("/documents/process", async (request, reply) => {
        try {
            const { text, title, chunkSize, overlap = 100, documentId, metadata = {} } = request.body as {
                text: string;
                title: string;
                chunkSize: number;
                overlap?: number;
                documentId?: string;
                metadata?: Record<string, unknown>;
            };

            const finalDocumentId = documentId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const chunks = createTextChunks(text, chunkSize, overlap);

            if (chunks.length === 0) {
                return reply.code(400).send({ error: "Não foi possível gerar chunks do texto fornecido" });
            }

            const embeddings: number[][] = await embeddingGenerator.generate(chunks);

            const chunksData = chunks.map((chunk, index) => ({
                documentId: finalDocumentId,
                chunkIndex: index,
                content: chunk,
                embedding: embeddings[index] as number[],
                metadata: {
                    ...metadata,
                    title: title,
                    originalTextLength: text.length,
                    chunkSize: chunkSize,
                    overlap: overlap,
                    totalChunks: chunks.length
                }
            }));

            const chunkIds = await vectorStore.saveChunks(chunksData);

            reply.send({
                success: true,
                documentId: finalDocumentId,
                title: title,
                chunksCreated: chunks.length,
                chunkIds: chunkIds,
                textLength: text.length,
                avgChunkLength: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)
            });

        } catch (error: unknown) {
            console.error("Erro ao processar documento:", error);
            reply.code(500).send({
                error: "Erro interno do servidor",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    app.post("/search", async (request, reply) => {
        try {
            const { query, limit, minSimilarity = 0.7 } = request.body as {
                query: string;
                limit: number;
                minSimilarity?: number;
            };

            const queryEmbeddings = await embeddingGenerator.generate([query]);
            const queryEmbedding = queryEmbeddings[0];

            if (!queryEmbedding || queryEmbedding.length === 0) {
                return reply.code(400).send({ error: "Não foi possível gerar embedding para a consulta" });
            }

            const similarChunks = await vectorStore.searchSimilar(queryEmbedding, limit, minSimilarity);

            const results = similarChunks.map((chunk: { id: number, document_id: string, chunk_index: number, content: string, metadata: Record<string, unknown>, similarity: number }) => ({
                id: chunk.id,
                documentId: chunk.document_id,
                chunkIndex: chunk.chunk_index,
                content: chunk.content,
                similarity: parseFloat(chunk.similarity.toFixed(4)),
                metadata: chunk.metadata
            }));

            reply.send({
                success: true,
                query: query,
                resultsFound: results.length,
                results: results
            });

        } catch (error: unknown) {
            console.error("Erro na busca:", error);
            reply.code(500).send({
                error: "Erro interno do servidor",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    app.get("/stats", async (request, reply) => {
        try {
            const stats = await vectorStore.getStats();
            reply.send({
                success: true,
                statistics: stats
            });
        } catch (error: unknown) {
            console.error("Erro ao obter estatísticas:", error);
            reply.code(500).send({
                error: "Erro interno do servidor",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });

    return app;
}