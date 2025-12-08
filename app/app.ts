import fastify from "fastify";
import jwt from "jsonwebtoken";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import TensorflowEmbedding from "./services/tensorflow-embedding.js";
import VectorDocumentStore from "./db/vector-document-store.js";
import { createTextChunks } from "./utils/utils.js";

const PUBLIC_ROUTES = [
  "/api/login",
  "/health",
];

export async function createApp() {
  const app = fastify();

  await app.register(swagger, {
    openapi: {
      info: {
        title: "RAG API",
        description: "API para Retrieval-Augmented Generation com embeddings e busca vetorial",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://0.0.0.0:3000",
          description: "Servidor local",
        },
      ],
      tags: [
        { name: "Health", description: "Endpoints de saúde da API" },
        { name: "Documents", description: "Processamento de documentos e chunks" },
        { name: "Search", description: "Busca por similaridade" },
        { name: "Stats", description: "Estatísticas do sistema" },
      ],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "full",
      deepLinking: false,
    },
  });

  await app.register(import("@fastify/cors"), {
    origin: [
      "*"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  });

  app.addHook("preHandler", async (request, reply) => {
    const path = request.url?.split("?")[0] || "";

    if (PUBLIC_ROUTES.includes(path)) {
      return;
    }

    if (path.startsWith("/docs")) {
      return;
    }

    const authHeader = request.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return reply.status(401).send({ error: "Token de acesso requerido" });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET as string) as { access_token: string };

    } catch (error) {
      return reply.status(401).send({ error: "Token JWT inválido: " + error });
    }
  });

  const embeddingGenerator = new TensorflowEmbedding();
  const vectorStore = new VectorDocumentStore({});
  await vectorStore.initialize();

  app.get("/api/login", 
    {
      schema: {
        tags: ["Auth"],
        summary: "Obter token de acesso",
        description: "Endpoint para obter um token JWT de acesso à API",
        response: {
          200: {
            type: "object",
            properties: {
              access_token: { type: "string" },
              token_type: { type: "string" },
              expires_in: { type: "number" },
            },
          },
        },
      },
    },    
    async (request, reply) => {
    const accessToken = jwt.sign(
      { access_token: "rag_api_access" },
      process.env.JWT_SECRET as string,
      { expiresIn: "12h" },
    );

    reply.send({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 43200
     });
  });

  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Verificar saúde da API",
        description: "Endpoint para verificar se a API está funcionando corretamente",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      reply.send({ status: "OK", timestamp: new Date().toISOString() });
    },
  );

  app.post(
    "/documents/process",
    {
      schema: {
        tags: ["Documents"],
        summary: "Processar documento em chunks",
        description:
          "Recebe um texto bruto, divide em chunks, gera embeddings e armazena no banco de dados",
        body: {
          type: "object",
          required: ["text", "title", "chunkSize"],
          properties: {
            text: {
              type: "string",
              minLength: 1,
              description: "Texto bruto a ser processado",
            },
            title: {
              type: "string",
              minLength: 1,
              description: "Título do documento",
            },
            chunkSize: {
              type: "number",
              minimum: 50,
              maximum: 4000,
              description: "Tamanho de cada chunk em caracteres",
            },
            overlap: {
              type: "number",
              minimum: 0,
              description: "Sobreposição entre chunks em caracteres (padrão: 100)",
            },
            documentId: {
              type: "string",
              description:
                "ID personalizado do documento (se não fornecido, será gerado automaticamente)",
            },
            metadata: {
              type: "object",
              description: "Metadados adicionais do documento",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              documentId: { type: "string" },
              title: { type: "string" },
              chunksCreated: { type: "number" },
              chunkIds: {
                type: "array",
                items: { type: "number" },
              },
              textLength: { type: "number" },
              avgChunkLength: { type: "number" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: {
                type: "string",
              },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          text,
          title,
          chunkSize,
          overlap = 100,
          documentId,
          metadata = {},
        } = request.body as {
          text: string;
          title: string;
          chunkSize: number;
          overlap?: number;
          documentId?: string;
          metadata?: Record<string, unknown>;
        };

        const finalDocumentId =
          documentId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const chunks = createTextChunks(text, chunkSize, overlap);

        if (chunks.length === 0) {
          return reply
            .code(400)
            .send({ error: "Não foi possível gerar chunks do texto fornecido" });
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
            totalChunks: chunks.length,
          },
        }));

        const chunkIds = await vectorStore.saveChunks(chunksData);

        reply.send({
          success: true,
          documentId: finalDocumentId,
          title: title,
          chunksCreated: chunks.length,
          chunkIds: chunkIds,
          textLength: text.length,
          avgChunkLength: Math.round(
            chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
          ),
        });
      } catch (error: unknown) {
        console.error("Erro ao processar documento:", error);
        reply.code(500).send({
          error: "Erro interno do servidor",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.post(
    "/search",
    {
      schema: {
        tags: ["Search"],
        summary: "Buscar chunks similares",
        description:
          "Recebe uma consulta em texto e retorna chunks similares usando busca vetorial",
        body: {
          type: "object",
          required: ["query", "limit"],
          properties: {
            query: {
              type: "string",
              minLength: 1,
              description: "Texto da consulta para busca",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 50,
              description: "Número máximo de resultados a retornar",
            },
            minSimilarity: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Similaridade mínima para incluir no resultado (padrão: 0.7)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              query: { type: "string" },
              resultsFound: { type: "number" },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    documentId: { type: "string" },
                    chunkIndex: { type: "number" },
                    content: { type: "string" },
                    similarity: { type: "number" },
                    metadata: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: {
                type: "string",
              },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          query,
          limit,
          minSimilarity = 0.7,
        } = request.body as {
          query: string;
          limit: number;
          minSimilarity?: number;
        };

        const queryEmbeddings = await embeddingGenerator.generate([query]);
        const queryEmbedding = queryEmbeddings[0];

        if (!queryEmbedding || queryEmbedding.length === 0) {
          return reply
            .code(400)
            .send({ error: "Não foi possível gerar embedding para a consulta" });
        }

        const similarChunks = await vectorStore.searchSimilar(queryEmbedding, limit, minSimilarity);

        const results = similarChunks.map(
          (chunk: {
            id: number;
            document_id: string;
            chunk_index: number;
            content: string;
            metadata: Record<string, unknown>;
            similarity: number;
          }) => ({
            id: chunk.id,
            documentId: chunk.document_id,
            chunkIndex: chunk.chunk_index,
            content: chunk.content,
            similarity: parseFloat(chunk.similarity.toFixed(4)),
            metadata: chunk.metadata,
          }),
        );

        reply.send({
          success: true,
          query: query,
          resultsFound: results.length,
          results: results,
        });
      } catch (error: unknown) {
        console.error("Erro na busca:", error);
        reply.code(500).send({
          error: "Erro interno do servidor",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.get(
    "/stats",
    {
      schema: {
        tags: ["Stats"],
        summary: "Obter estatísticas do sistema",
        description: "Retorna estatísticas sobre documentos e chunks armazenados no sistema",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              statistics: {
                type: "object",
                properties: {
                  total_documents: {
                    type: "string",
                    description: "Número total de documentos únicos",
                  },
                  total_chunks: {
                    type: "string",
                    description: "Número total de chunks",
                  },
                  avg_chunk_size: {
                    type: "string",
                    description: "Tamanho médio dos chunks em caracteres",
                  },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const stats = await vectorStore.getStats();
        reply.send({
          success: true,
          statistics: stats,
        });
      } catch (error: unknown) {
        console.error("Erro ao obter estatísticas:", error);
        reply.code(500).send({
          error: "Erro interno do servidor",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  return app;
}
