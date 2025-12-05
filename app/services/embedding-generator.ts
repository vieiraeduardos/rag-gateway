export default abstract class EmbeddingGenerator {
    abstract generate(texts: string[]): Promise<number[][]>;
}