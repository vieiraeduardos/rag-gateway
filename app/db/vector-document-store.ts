import pg, { type PoolClient } from "pg";
const { Pool } = pg;

class VectorDocumentStore {
  pool: pg.Pool;
  constructor(config: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    maxConnections?: number;
  }) {
    this.pool = new Pool({
      host: config.host || process.env.POSTGRES_HOST,
      port: (config.port as number) || parseInt(process.env.POSTGRES_PORT as string),
      database: config.database || process.env.POSTGRES_DB,
      user: config.user || process.env.POSTGRES_USER,
      password: config.password || process.env.POSTGRES_PASSWORD,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize() {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector;");

      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id SERIAL PRIMARY KEY,
          document_id VARCHAR(255) NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding vector(512),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
        ON document_chunks 
        USING hnsw (embedding vector_cosine_ops);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS document_chunks_doc_id_idx 
        ON document_chunks (document_id);
      `);
    } catch (error) {
      console.error("Erro ao inicializar banco:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveChunks(
    chunks: {
      documentId: string;
      chunkIndex: number;
      content: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }[],
  ) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const ids: number[] = [];
      for (const chunk of chunks) {
        const result = await client.query<{ id: number }>(
          `INSERT INTO document_chunks 
           (document_id, chunk_index, content, embedding, metadata) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [
            chunk.documentId,
            chunk.chunkIndex,
            chunk.content,
            `[${chunk.embedding.join(",")}]`,
            JSON.stringify(chunk.metadata || {}),
          ],
        );

        if (result.rows.length === 0) {
          throw new Error("Failed to insert chunk and retrieve ID.");
        }

        ids.push(result.rows[0]!.id);
      }

      await client.query("COMMIT");
      return ids;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao salvar chunks:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchSimilar(embedding: number[], limit = 5, minSimilarity = 0.7) {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query<{
        id: number;
        document_id: string;
        chunk_index: number;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
      }>(
        `SELECT 
          id, 
          document_id, 
          chunk_index, 
          content, 
          metadata,
          1 - (embedding <=> $1) as similarity
         FROM document_chunks
         WHERE 1 - (embedding <=> $1) > $2
         ORDER BY embedding <=> $1
         LIMIT $3`,
        [`[${embedding.join(",")}]`, minSimilarity, limit],
      );
      return result.rows;
    } catch (error) {
      console.error("Erro na busca vetorial:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDocumentChunks(documentId: string) {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query<{
        id: number;
        document_id: string;
        chunk_index: number;
        content: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, document_id, chunk_index, content, metadata, created_at
         FROM document_chunks
         WHERE document_id = $1
         ORDER BY chunk_index ASC`,
        [documentId],
      );
      return result.rows;
    } catch (error) {
      console.error("Erro ao buscar chunks do documento:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteDocument(documentId: string) {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
        documentId,
      ]);
      return result.rowCount;
    } catch (error) {
      console.error("Erro ao deletar documento:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMetadata(chunkId: number, metadata: Record<string, unknown>) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(
        `UPDATE document_chunks 
         SET metadata = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [JSON.stringify(metadata), chunkId],
      );
    } catch (error) {
      console.error("Erro ao atualizar metadata:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats() {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query<{
        total_documents: number;
        total_chunks: number;
        avg_chunk_size: number;
      }>(`
        SELECT 
          COUNT(DISTINCT document_id) as total_documents,
          COUNT(*) as total_chunks,
          AVG(LENGTH(content)) as avg_chunk_size
        FROM document_chunks
      `);

      return result.rows[0];
    } catch (error) {
      console.error("Erro ao obter estatísticas:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

export default VectorDocumentStore;
