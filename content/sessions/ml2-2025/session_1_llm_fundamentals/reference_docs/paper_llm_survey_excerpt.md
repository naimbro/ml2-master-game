# Large Language Models: A Survey (Excerpts)

*Este documento contiene extractos relevantes del paper asignado como lectura para la Sesion 1.*

---

## 1. Introduction to Large Language Models

Large Language Models (LLMs) are deep learning models trained on massive text corpora that can understand and generate human-like text. The emergence of models like GPT-3, GPT-4, Claude, and Llama has transformed how we approach natural language processing tasks.

### Key Characteristics of LLMs:
- **Scale**: Billions to trillions of parameters
- **Emergent capabilities**: Abilities that appear only at scale
- **Few-shot learning**: Can perform tasks with minimal examples
- **Generalization**: Transfer knowledge across domains

---

## 2. Transformer Architecture

The Transformer architecture, introduced by Vaswani et al. (2017), forms the backbone of all modern LLMs.

### Self-Attention Mechanism

The core innovation of Transformers is the self-attention mechanism, which allows the model to weigh the importance of different parts of the input when processing each element.

For a sequence of tokens, attention is computed as:

```
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
```

Where:
- Q (Query): What we're looking for
- K (Key): What each token offers
- V (Value): The actual information to retrieve

### Multi-Head Attention

Multiple attention "heads" allow the model to attend to information from different representation subspaces:

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W^O
```

This enables the model to capture different types of relationships simultaneously.

---

## 3. Tokenization

LLMs operate on tokens, not words. Tokenization is the process of converting text into these discrete units.

### Byte-Pair Encoding (BPE)

BPE is the most common tokenization method, used by GPT models:

1. Start with individual characters as tokens
2. Iteratively merge the most frequent pair of tokens
3. Repeat until desired vocabulary size is reached

**Example:**
- "machine" → ["mach", "ine"] (2 tokens)
- "learning" → ["learn", "ing"] (2 tokens)
- "Constitución" → ["Const", "itu", "ción"] (3 tokens)

### Implications for Non-English Languages

Spanish and other languages with diacritics and different word structures often require more tokens than English for equivalent content. This has cost implications when using pay-per-token APIs.

---

## 4. Embeddings and Semantic Search

### What are Embeddings?

Embeddings are dense vector representations of text that capture semantic meaning. Similar concepts have similar embeddings.

**Properties:**
- High-dimensional (typically 768-1536 dimensions)
- Dense (most values are non-zero)
- Learned during training
- Enable mathematical operations on meaning

### Semantic Search vs Keyword Search

| Aspect | Keyword Search | Semantic Search |
|--------|----------------|-----------------|
| Matching | Exact terms | Conceptual similarity |
| Synonyms | Must be specified | Automatically captured |
| Context | Ignored | Considered |
| "No results" | Common | Rare |

### Vector Databases

Storing and searching embeddings efficiently requires specialized databases:
- **Pinecone**: Managed, scalable
- **Weaviate**: Open source, feature-rich
- **Milvus**: High performance, open source
- **pgvector**: PostgreSQL extension

---

## 5. Hallucinations in LLMs

### Definition

Hallucination refers to the generation of content that is fluent and plausible but factually incorrect or nonsensical.

### Types of Hallucinations

1. **Factual Hallucination**: Incorrect facts (wrong dates, numbers, names)
2. **Fabrication**: Inventing non-existent entities or events
3. **Unfaithful to Source**: Contradicting provided context

### Causes

- Training objective optimizes for plausibility, not factuality
- Lack of grounding to external knowledge
- Pressure to provide complete answers
- Knowledge cutoff limitations

### Mitigation Strategies

1. **Retrieval-Augmented Generation (RAG)**
   - Retrieve relevant documents before generation
   - Ground responses in actual sources
   - Cite sources explicitly

2. **Lower Temperature**
   - Reduce randomness in token selection
   - More deterministic outputs
   - Trade-off: less creative responses

3. **Constrained Generation**
   - Limit outputs to known formats/values
   - Use structured output schemas

4. **Human-in-the-Loop**
   - Mandatory review for critical applications
   - Flag low-confidence responses

---

## 6. Generation Parameters

### Temperature

Temperature controls the randomness of predictions:

- **T = 0**: Always select the most probable token (deterministic)
- **T = 1**: Standard probability distribution
- **T > 1**: Flatter distribution, more randomness

**Recommendations by Use Case:**
- Factual Q&A: T = 0.0 - 0.3
- Creative writing: T = 0.7 - 1.0
- Code generation: T = 0.2 - 0.5

### Top-p (Nucleus Sampling)

Limits selection to tokens comprising the top p probability mass:
- Top-p = 0.1: Only consider tokens in top 10% probability
- Works in conjunction with temperature

### Max Tokens

Limits the length of generated response:
- Prevents runaway generation
- Controls costs
- Ensures concise responses

---

## 7. Deployment Considerations

### API-based vs Self-hosted

| Factor | API (OpenAI, etc.) | Self-hosted |
|--------|-------------------|-------------|
| Setup time | Minutes | Days/Weeks |
| Cost model | Per token | Fixed (infrastructure) |
| Data privacy | Data leaves premises | Full control |
| Maintenance | Provider handles | Your responsibility |
| Customization | Limited | Full fine-tuning |
| Performance | State-of-the-art | Depends on hardware |

### Considerations for Government/Public Sector

1. **Data Sovereignty**: Where is data processed and stored?
2. **Privacy Compliance**: GDPR, local regulations
3. **Auditability**: Can decisions be explained and traced?
4. **Vendor Lock-in**: Long-term strategic implications
5. **Budget Predictability**: Per-token vs fixed costs

---

## References

- Vaswani, A., et al. (2017). "Attention Is All You Need"
- Brown, T., et al. (2020). "Language Models are Few-Shot Learners"
- Touvron, H., et al. (2023). "LLaMA: Open and Efficient Foundation Language Models"
- Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
