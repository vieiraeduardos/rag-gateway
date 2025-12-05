
export function createTextChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
        const endIndex = Math.min(currentIndex + chunkSize, text.length);
        const chunk = text.substring(currentIndex, endIndex);
        chunks.push(chunk);
        
        // Move para o próximo chunk com overlap
        currentIndex += chunkSize - overlap;
        
        // Se o overlap é maior que o chunk restante, pare
        if (currentIndex >= text.length) break;
    }
    
    return chunks;
}