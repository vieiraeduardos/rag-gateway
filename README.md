# RAG Gateway

Uma API completa para **Retrieval-Augmented Generation (RAG)** usando embeddings TensorFlow e busca vetorial com PostgreSQL + pgvector.

## 🚀 Funcionalidades

- **Processamento de documentos**: Divisão automática de textos em chunks com overlap configurável
- **Geração de embeddings**: Usando TensorFlow Universal Sentence Encoder
- **Armazenamento vetorial**: PostgreSQL com extensão pgvector para busca de similaridade
- **Busca semântica**: Algoritmo de busca por similaridade coseno
- **API REST completa**: Endpoints bem documentados com Swagger/OpenAPI
- **TypeScript**: Código totalmente tipado para melhor manutenibilidade

## 📋 Pré-requisitos

- **Node.js** 18+ 
- **PostgreSQL** 12+ com extensão **pgvector**
- **npm** ou **yarn**

## 🛠️ Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/vieiraeduardos/rag-gateway.git
cd rag-gateway
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o ambiente**

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
- Para desenvolvimento local: mantenha as configurações padrão
- Para produção: ajuste `POSTGRES_HOST`, senhas e chaves de API

> 💡 **Dica**: O arquivo `.env.example` já vem com todas as variáveis necessárias configuradas para funcionar com o Docker Compose.

4. **Configure o banco de dados**

**Opção 1: Usando Docker Compose (Recomendado)**
```bash
# Inicia PostgreSQL com pgvector automaticamente
docker-compose up -d pgvector
```

**Opção 2: PostgreSQL local**
```sql
-- Conecte ao PostgreSQL e execute:
CREATE DATABASE rag_db;
\c rag_db;
CREATE EXTENSION IF NOT EXISTS vector;
```

5. **Execute a aplicação**

**Desenvolvimento local:**
```bash
npm run build
npm start
```

**Com Docker Compose (ambiente completo):**
```bash
docker-compose up
```

## 📚 Documentação da API

Acesse a documentação interativa do Swagger em: **http://127.0.0.1:3000/docs**

### Endpoints Disponíveis

#### 🔍 **GET /health**
Verifica se a API está funcionando

#### 📄 **POST /documents/process**
Processa um documento, gerando chunks e embeddings

**Exemplo de requisição:**
```json
{
  "text": "Seu texto longo aqui que será dividido em chunks...",
  "title": "Documento de Exemplo",
  "chunkSize": 1000,
  "overlap": 100,
  "metadata": {
    "categoria": "documentação",
    "autor": "João Silva"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "documentId": "doc_1701234567890_abc123def",
  "title": "Documento de Exemplo",
  "chunksCreated": 5,
  "chunkIds": [1, 2, 3, 4, 5],
  "textLength": 5000,
  "avgChunkLength": 1000
}
```

#### 🔎 **POST /search**
Busca chunks similares a uma consulta

**Exemplo de requisição:**
```json
{
  "query": "Como configurar o banco de dados?",
  "limit": 5,
  "minSimilarity": 0.75
}
```

**Resposta:**
```json
{
  "success": true,
  "query": "Como configurar o banco de dados?",
  "resultsFound": 3,
  "results": [
    {
      "id": 1,
      "documentId": "doc_123",
      "chunkIndex": 0,
      "content": "Este chunk contém informações sobre configuração...",
      "similarity": 0.8543,
      "metadata": {
        "title": "Documento de Exemplo",
        "categoria": "documentação"
      }
    }
  ]
}
```

#### 📊 **GET /stats**
Retorna estatísticas do sistema

## 🏗️ Arquitetura

```
├── app/
│   ├── app.ts                    # Configuração principal da aplicação
│   ├── index.ts                  # Ponto de entrada do servidor
│   ├── services/
│   │   ├── tensorflow-embedding.ts  # Geração de embeddings
│   │   └── embedding-generator.ts   # Interface base
│   ├── db/
│   │   └── vector-document-store.ts # Operações do banco vetorial
│   └── utils/
│       └── utils.ts              # Funções utilitárias
├── dist/                         # Arquivos JavaScript compilados
├── package.json
├── tsconfig.json
└── README.md
```

## 🧠 Como Funciona

1. **Chunking**: O texto é dividido em pedaços menores com overlap configurável
2. **Embedding**: Cada chunk é convertido em um vetor numérico usando TensorFlow
3. **Armazenamento**: Chunks e embeddings são salvos no PostgreSQL com pgvector
4. **Busca**: Consultas são convertidas em embeddings e comparadas por similaridade coseno
5. **Resultados**: Chunks mais similares são retornados ordenados por relevância

## 🔧 Desenvolvimento

### Scripts disponíveis:

```bash
npm run build      # Compila TypeScript para JavaScript
npm run start      # Inicia o servidor em produção
npm run lint       # Verifica código com ESLint
npm run lint:fix   # Corrige problemas de lint automaticamente
npm run format     # Formata código com Prettier
```

### Adicionando novos geradores de embedding:

1. Implemente a interface `EmbeddingGenerator`
2. Registre o novo serviço em `app.ts`
3. Configure as variáveis de ambiente necessárias

## 🚀 Deploy

### Docker Compose (Recomendado)

O projeto inclui um `docker-compose.yml` completo que configura automaticamente:
- PostgreSQL com pgvector habilitado
- API RAG com todas as dependências
- Rede isolada para comunicação entre serviços

```bash
# Deploy completo em um comando
docker-compose up -d
```

### Docker Manual

O `Dockerfile` incluído já está otimizado com TensorFlow e Node.js:

```bash
# Build da imagem
docker build -t rag-api .

# Executar (certifique-se que o PostgreSQL está rodando)
docker run -p 3000:3000 --env-file .env rag-api
```

### Variáveis de ambiente

Consulte o arquivo `.env.example` para todas as variáveis disponíveis. Para produção, ajuste principalmente:

- `HOST`: Use `0.0.0.0` para Docker
- `POSTGRES_HOST`: Endereço do seu banco PostgreSQL
- `GEMINI_API_KEY`: Sua chave da API do Google Gemini

## 🧪 Testes

```bash
# Executar testes (quando implementados)
npm test

# Testar endpoint de saúde
curl http://localhost:3000/health

# Com Docker Compose rodando:
curl http://localhost:3000/health
```

## ⚡ Quick Start

Para começar rapidamente com Docker:

```bash
git clone https://github.com/vieiraeduardos/rag-gateway.git
cd rag-gateway
cp .env.example .env
docker-compose up
```

Acesse: http://localhost:3000/docs

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 🆘 Suporte

Se encontrar algum problema:

1. Verifique se o PostgreSQL está rodando com pgvector habilitado
2. Confirme que as variáveis de ambiente estão corretas
3. Consulte os logs do servidor para erros específicos
4. Acesse a documentação do Swagger em `/docs`

## 🔗 Links Úteis

- [Documentação do pgvector](https://github.com/pgvector/pgvector)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [Universal Sentence Encoder](https://tfhub.dev/google/universal-sentence-encoder/4)
