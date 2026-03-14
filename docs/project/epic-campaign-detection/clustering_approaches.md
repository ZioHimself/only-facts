# Clustering Approaches Comparison

Comparison of narrative clustering methods from simple keyword baselines to LLM-assisted approaches, with feasibility guidance for the current dataset and project constraints.

---

## 1) Keyword/Hashtag Rule Clustering (Very Simple)

### How it works
- Normalize text (lowercase, strip URLs/mentions, basic tokenization).
- Extract keywords and hashtags.
- Cluster posts by overlap score (e.g., Jaccard similarity).

### Complexity
- Low

### Pros
- Fast and easy to implement.
- Highly interpretable and easy to debug.
- Good baseline to validate data pipeline and outputs.

### Cons
- Poor handling of paraphrase/synonyms.
- Vulnerable to wording variations.
- High false positives with common terms.

### Feasibility
- Very high.
- Best used as a baseline, not final method.

---

## 2) TF-IDF + Cosine Similarity + Time Windows (Simple)

### How it works
- Convert posts into TF-IDF vectors.
- Compute cosine similarity.
- Cluster with DBSCAN or agglomerative clustering within time windows.

### Complexity
- Low-medium

### Pros
- Better lexical signal than pure keywords.
- Computationally manageable for large datasets with batching.

### Cons
- Still lexical; weak on semantic equivalence.
- Multilingual data may require language segmentation.

### Feasibility
- High.
- Strong practical next step after keyword baseline.

---

## 3) Graph-Based Propagation Clustering (Medium)

### How it works
- Build a graph from repost/reply/reference relations.
- Detect communities (e.g., connected components, Louvain, Leiden).
- Optionally refine communities with text similarity.

### Complexity
- Medium

### Pros
- Captures coordination and amplification behavior.
- Less sensitive to wording changes.
- Aligns well with disinformation campaign detection objectives.

### Cons
- Depends on quality/completeness of reference edges.
- Needs threshold tuning and graph design decisions.

### Feasibility
- High for this dataset, especially with substantial retweet activity.

---

## 4) Hybrid Multi-Signal Clustering (Text + Time + Graph + Account) (Medium-High)

### How it works
- Combine multiple similarity signals:
  - text similarity
  - temporal proximity
  - graph affinity
  - account co-participation
- Cluster, then merge/split based on coherence criteria.

### Complexity
- Medium-high

### Pros
- Most robust approach for campaign/narrative detection.
- Balances semantic grouping with behavioral evidence.
- Supports explainable downstream scoring.

### Cons
- More implementation effort and tuning overhead.
- Requires evaluation framework to calibrate thresholds.

### Feasibility
- High if implemented iteratively.
- Recommended target architecture for MVP+.

---

## 5) Embedding-Based Semantic Clustering (High)

### How it works
- Generate sentence embeddings for posts.
- Use ANN index (e.g., FAISS/HNSW) and clustering (e.g., HDBSCAN).
- Optionally use language-aware or multilingual embedding models.

### Complexity
- High

### Pros
- Strong semantic grouping and paraphrase handling.
- Better narrative coherence than lexical methods.

### Cons
- Higher compute/storage costs.
- Requires careful model and batching strategy.
- Pure embedding clusters may miss behavioral coordination unless hybridized.

### Feasibility
- Medium-high.
- Feasible as phase 2 after baseline pipeline is stable.

---

## 6) LLM-Based Content Comparison (Very High)

### How it works
- Use an LLM to assess if posts/clusters share the same narrative.
- Optionally generate claim framing labels and cluster summaries.

### Complexity
- Very high

### Pros
- Strong nuanced semantic understanding.
- Useful for edge cases, validation, and explanation quality.

### Cons
- Expensive and slow at scale.
- Non-deterministic outputs.
- Pairwise comparison does not scale for very large datasets.

### Feasibility
- Medium for selective use (validation/reranking).
- Low as primary clustering engine over full corpus.

---

## Recommended Practical Path

1. Start with TF-IDF + time-window clustering as baseline.
2. Add graph/account behavior signals to capture coordination.
3. Introduce embeddings for merge/split quality improvements.
4. Use LLM selectively for hard-case validation and narrative labeling.

This progression balances speed, cost, and quality while keeping the system explainable and operationally feasible.
