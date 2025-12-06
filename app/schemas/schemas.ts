export const searchSchema = {
  body: {
    type: "object",
    required: ["query", "limit"],
    properties: {
      query: { type: "string", minLength: 1 },
      limit: { type: "number", minimum: 1, maximum: 50 },
      minSimilarity: { type: "number", minimum: 0, maximum: 1, default: 0.7 },
    },
  },
};

export const processDocumentSchema = {
  body: {
    type: "object",
    required: ["text", "title", "chunkSize"],
    properties: {
      text: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      chunkSize: { type: "number", minimum: 50, maximum: 4000 },
      overlap: { type: "number", minimum: 0, default: 100 },
      documentId: { type: "string" },
      metadata: { type: "object" },
    },
  },
};
