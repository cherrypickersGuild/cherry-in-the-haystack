# Chapter 9: Inference Optimization

- The central importance of making models faster and cheaper alongside better
- Speed and cost failures: slow predictions becoming useless, poor ROI
- Three levels of inference optimization: model, hardware, and service
- Inference as an interdisciplinary field spanning researchers, engineers, and hardware architects
- Chapter scope: bottlenecks, model-level and service-level techniques, accelerator overview
- Performance trade-offs: speed-ups that also reduce cost versus speed-ups that increase cost
- Value of understanding inference optimization even when using third-party APIs

## Understanding Inference Optimization

- The two phases of an AI model lifecycle: training versus inference

### Inference Overview

- Definition of an inference server and its role in a broader inference service
- Figure 9-1: visualization of a simple inference service
- Model APIs as inference services and the responsibility of self-hosted model operators

#### Computational bottlenecks

- Definition and framing of optimization as identifying and addressing bottlenecks
- Two main computational bottleneck types: compute-bound and memory bandwidth-bound
- Compute-bound definition and example (password decryption)
- Memory bandwidth-bound definition and example (CPU-to-GPU data transfer)

> **Terminology Ambiguity: Memory-Bound Versus Bandwidth-Bound** — distinction between memory-capacity-bound (OOM errors) and memory-bandwidth-bound, and why capacity limits often reduce to bandwidth problems

- Roofline model (Williams et al., 2009): arithmetic intensity and classifying operations
- Figure 9-2: roofline chart showing compute-bound versus memory bandwidth-bound operations
- Optimization technique selection based on bottleneck type
- Different bottleneck profiles across model architectures (Stable Diffusion vs. autoregressive LMs)
- Prefill step as compute-bound due to parallel token processing
- Decode step as memory bandwidth-bound due to large matrix loading
- Figure 9-3: visualization of prefill and decode steps in autoregressive inference
- Decoupling prefill and decode in production as a consequence of differing computational profiles
- Factors affecting LLM inference bottlenecks: context length, output length, batching strategy
- Current predominance of memory bandwidth-bound AI workloads and the future outlook

#### Online and batch inference APIs

- Two API types: online (latency-optimized) versus batch (cost-optimized)
- Batch API cost savings example: 50% discount at Gemini and OpenAI with higher turnaround time
- Online APIs still batching requests when it does not significantly impact latency
- Customer-facing use cases suited to online APIs versus use cases suited to batch APIs
- List of batch-suitable workloads: synthetic data, reporting, onboarding, model migration, recommendations, knowledge base updates
- Streaming mode: returning tokens as generated to reduce time to first token
- Risk of streaming: inability to score responses before user sees them

> **Batch API for Foundation Models vs. Traditional ML** — distinction between foundation model batch APIs (high-latency processing) and traditional ML batch inference (precomputed predictions); why open-ended inputs prevent precomputation

### Inference Performance Metrics

- The central axes for measuring inference: latency for users, throughput and utilization for developers

#### Latency, TTFT, and TPOT

- Latency definition: time from query send to complete response receipt
- Time to first token (TTFT): duration of prefill step, application-dependent expectations
- Time per output token (TPOT): per-token generation speed after first token
- Human reading speed benchmark: ~120 ms/token (6–8 tokens/second) as TPOT target
- Time between tokens (TBT) and inter-token latency (ITL) as related metrics
- Total latency formula: TTFT + TPOT × (number of output tokens)
- Trade-off between TTFT and TPOT user experience and the role of user studies
- TTFT and TPOT as observed by models versus observed by users in CoT/agentic contexts
- "Time to publish" metric for agentic applications where intermediate steps are hidden
- Three-step agentic scenario illustrating the gap between model-side and user-side TTFT
- Latency as a distribution: how outliers skew the average and the need for percentile analysis
- Recommended percentiles for latency monitoring: p50, p90, p95, p99

#### Throughput and goodput

- Throughput definition: output tokens per second across all users and requests
- Input vs. output token throughput counted separately due to differing computational profiles
- Tokens per second (TPS) and tokens/s/user as throughput metrics
- Requests per second (RPS) and requests per minute (RPM) for request-level throughput
- Rate limit implications of high concurrent request volumes
- Throughput's direct link to compute cost; example cost calculations for decoding and prefilling
- Factors affecting what constitutes good throughput: model size, hardware, workload consistency
- Tokenizer differences making direct throughput comparisons approximate
- Latency/throughput trade-off: potential to double or triple throughput at the cost of latency
- Goodput definition: requests per second satisfying the SLO
- Figure 9-4: visualization of goodput versus raw throughput given an SLO

#### Utilization, MFU, and MBU

- General definition of utilization metrics as proportion of resource actively used
- GPU utilization in nvidia-smi: percentage of time GPU is actively processing, not efficiency
- The problem with nvidia-smi's utilization metric: active ≠ efficient
- MFU (Model FLOP/s Utilization): ratio of observed throughput to theoretical peak throughput
- MBU (Model Bandwidth Utilization): percentage of theoretical memory bandwidth used
- MBU formula and example calculation for Llama 2 7B in FP16
- Quantization's impact on MBU via reduced bytes per parameter
- MFU example calculation on A100-80GB
- Linear relationship between throughput and both MBU and MFU
- What constitutes good MFU and MBU depending on workload type
- MFU comparison: training vs. inference, prefill vs. decode
- Table 9-1: MFU examples for GPT-3, Gopher, Megatron-Turing NLG, and PaLM across accelerators
- Figure 9-5: MBU for Llama 2-70B in FP16 across different hardware chips
- Utilization as an efficiency indicator, not the ultimate goal; what truly matters is cost and speed

## AI Accelerators

- Interdependence of AI model development and hardware development throughout history
- First AI winter and the role of compute limitations in the 1970s
- AlexNet (2012) and the GPU as the catalyst for the deep learning research boom

### What's an accelerator?

- Definition of an accelerator as a chip for specific computational workloads
- GPU dominance and NVIDIA's economic role in the early 2020s AI boom
- CPU vs. GPU design philosophy: general-purpose vs. parallel processing
- CPU characteristics: few powerful cores, single-thread excellence, sequential tasks
- GPU characteristics: thousands of smaller cores, matrix multiplication, parallelizable ML workloads
- Challenges of parallel processing on memory design and power consumption
- Survey of AI accelerator landscape: AMD GPUs, Google TPU, Intel Gaudi, Graphcore IPU, Groq LPU, Cerebras QPU
- Inference vs. training cost distribution: inference can exceed training cost and accounts for up to 90% of deployed ML costs
- Training vs. inference chip design differences: memory, precision, and latency priorities
- Inference-specialized chip examples: Apple Neural Engine, AWS Inferentia, MTIA, Edge TPU, Jetson Xavier
- Chips specialized for transformer architecture and the trend toward consumer device chips
- Figure 9-6: different compute primitives (scalar, vector, tensor) across hardware architectures
- Mixing compute units in modern chips: GPU tensor cores vs. TPU tensor-primary design
- Three main chip characteristics that matter across use cases: FLOP/s, memory, power

#### Computational capabilities

- FLOP/s as the standard metric for computational capability
- The gap between peak FLOP/s and achievable FLOP/s; utilization as the ratio
- Numerical precision's effect on operations per second: higher precision → fewer ops
- Table 9-2: FLOP/s specs for NVIDIA H100 SXM at TF32, BF16, FP16, and FP8 precision

#### Memory size and bandwidth

- Why GPU memory needs higher bandwidth than CPU memory: parallel core data movement
- CPU DDR SDRAM (2D structure) vs. GPU HBM (3D stacked structure)
- Three levels of memory in an AI accelerator system: CPU DRAM, GPU HBM, GPU on-chip SRAM
- CPU DRAM characteristics: lowest bandwidth (25–50 GB/s), largest capacity (16 GB–1 TB+)
- GPU HBM characteristics: high bandwidth (256 GB/s–1.5 TB/s), 24–80 GB capacity
- GPU on-chip SRAM characteristics: extremely high speed (>10 TB/s), small size (≤40 MB)
- Figure 9-7: memory hierarchy visualization with reference numbers
- GPU optimization as an exercise in exploiting the memory hierarchy
- Low-level GPU programming languages: CUDA, OpenAI's Triton, ROCm

#### Power consumption

- Transistor switching as the source of energy consumption and heat generation
- Transistor counts: NVIDIA A100 at 54B, H100 at 80B transistors
- Annual energy consumption of an H100 at peak: ~7,000 kWh vs. 10,000 kWh average US household
- Electricity as a bottleneck to scaling compute and data center location constraints
- Maximum power draw vs. TDP as power consumption specifications
- Cloud provider abstraction from cooling and electricity concerns

### Selecting Accelerators

- Workload-based accelerator selection: compute-bound → more FLOP/s; memory-bound → more bandwidth
- Three questions for chip evaluation: can it run the workload, how long, and at what cost
- FLOP/s, memory size, and bandwidth as the three decisive numbers

## Inference Optimization

- Three levels of inference optimization: model (arrows), hardware (archer), service (shooting process)
- Quality degradation risk from optimization techniques
- Figure 9-8: same Llama model showing different quality across inference service providers
- Scope of chapter: model-level and service-level techniques, not hardware design

## Model Optimization

- Three resource-intensive characteristics of foundation models: size, autoregressive decoding, attention mechanism

### Model compression

- Overview of compression techniques: quantization, distillation, and pruning
- Pruning definition: removing nodes (architecture change) or zeroing out weights (sparsity)
- Pruned model uses: as-is inference or further finetuning to restore performance
- Pruning for architecture discovery and training pruned architectures from scratch
- Impressive pruning research results: 90%+ non-zero parameter reduction without accuracy loss
- Practical limitations of pruning: complexity, modest gains, hardware sparsity support issues
- Weight-only quantization as the most popular and effective compression approach
- Distillation as a common alternative producing comparable small models

### Overcoming the autoregressive decoding bottleneck

- Sequential token generation as slow and expensive: output tokens cost 2–4× input tokens
- Anyscale finding: one output token has the same latency impact as 100 input tokens
- Rapidly evolving techniques landscape for addressing this bottleneck

#### Speculative decoding

- Speculative decoding mechanism: draft model generates tokens, target model verifies in parallel
- Step-by-step speculative decoding process: draft K tokens → parallel verification → accept longest subsequence → generate one extra token
- Behavior when no draft tokens are accepted vs. when all are accepted (K+1 tokens)
- Figure 9-9: blockwise parallel decoding visualization from Stern et al. (2018)
- Three reasons speculative decoding avoids latency penalties: verification is parallelizable, easy tokens are predictable, idle decode FLOPs absorb verification cost
- Acceptance rate characteristics: domain-dependent, higher for structured text like code
- Draft model requirements: ideally same vocabulary and tokenizer as target
- DeepMind Chinchilla-70B example: 4B draft model achieving >50% latency reduction
- Popularity of speculative decoding: easy implementation, no quality change, integration into vLLM/TensorRT-LLM/llama.cpp

#### Inference with reference

- Core idea: copying tokens from input instead of generating them
- Similarity to speculative decoding but using input context as draft source
- Key challenge: algorithm to identify most relevant text span at each decoding step
- Unlike speculative decoding: no extra model required but limited to output-context overlap scenarios
- Use cases: retrieval systems, coding, multi-turn conversations
- Yang et al. (2023) result: 2× generation speedup in applicable use cases
- Figure 9-10: two examples of inference with reference with copied text spans

#### Parallel decoding

- Breaking sequential dependency: generating multiple future tokens simultaneously
- Intuition for why it works: existing sequence often predicts several tokens ahead
- Lookahead decoding (Fu et al., 2024): parallel tokens from the same decoder
- Medusa (Cai et al., 2024): multiple decoding heads, each trained to predict a specific future position
- Medusa training: heads trained alongside frozen original model
- NVIDIA claim: Medusa boosting Llama 3.1 by up to 1.9× on HGX H200
- Jacobi decoding verification: generate K tokens, verify coherence, re-generate failed tokens
- Medusa tree-based attention for verification: each head produces multiple options organized into a tree
- Figure 9-11: Medusa option tree visualization
- Appeal vs. complexity of parallel decoding

### Attention mechanism optimization

- KV cache rationale: reusing key-value vectors to avoid recomputing them at each decode step
- KV cache update mechanism: compute new K/V vectors for the latest token and append to cache
- Figure 9-12: KV cache diagram showing vector reuse

> **KV cache is inference-only** — training processes all tokens at once, eliminating the need for incremental KV caching

- Quadratic growth of attention computations vs. linear growth of KV cache with sequence length
- KV cache memory at scale: 3 TB for a 500B+ model at batch size 512, context 2048
- KV cache as a memory bottleneck for long-context applications and its latency impact
- Three optimization buckets for attention: redesign the mechanism, optimize the KV cache, write kernels

> **Calculating the KV Cache Size** — formula: 2 × B × S × L × H × M with LLama 2 13B worked example producing 54 GB

#### Redesigning the attention mechanism

- Constraint: architectural changes apply only during training or finetuning
- Local windowed attention (Beltagy et al., 2020): attending to fixed-size window, 10× KV cache reduction example
- Interleaving local and global attention: local for nearby context, global for task-specific information
- Cross-layer attention (Brandon et al., 2024): sharing K/V vectors across adjacent layers, 3× KV cache reduction
- Multi-query attention (Shazeer, 2019): sharing K/V vectors across query heads
- Grouped-query attention (Ainslie et al., 2023): grouping query heads and sharing K/V within groups
- Character.AI case study: 180-message average conversation, KV cache as primary bottleneck, 20× reduction via three attention designs

#### Optimizing the KV cache size

- Memory bottleneck mitigation through KV cache management for large-batch long-context serving
- PagedAttention in vLLM: non-contiguous blocks, reduced fragmentation, flexible memory sharing
- Other KV cache techniques: quantization, adaptive compression, selective KV cache

#### Writing kernels for attention computation

- Kernel writing approach: optimizing attention score computation for specific hardware
- FlashAttention (Dao et al., 2022): fused operators for transformer computation
- Figure 9-13: FlashAttention operator fusion diagram

### Kernels and compilers

- Definition of kernels: specialized hardware-optimized code for repeated parallel computation
- Common AI operations with specialized kernels: matmul, attention, convolution
- Low-level languages required: CUDA, Triton, ROCm
- Historical barrier to kernel writing as a specialized skill practiced by few
- Rising interest in kernel writing among AI engineers
- Four common kernel optimization techniques: vectorization, parallelization, loop tiling, operator fusion
- Vectorization: simultaneous processing of contiguous memory elements to reduce I/O
- Parallelization: dividing arrays into independent chunks for parallel processing
- Loop tiling: hardware-dependent access order optimization for cache efficiency
- Operator fusion: combining loops over the same array to reduce redundant memory access
- Operator fusion's higher complexity relative to the other three techniques
- Hardware-versioned kernels: FlashAttention for A100, FlashAttention-3 for H100
- Lowering: converting model code to hardware-compatible instructions; the role of compilers
- Standalone compilers: Apache TVM, MLIR; integrated compilers: torch.compile, XLA, TensorRT

> **Inference Optimization Case Study from PyTorch** — four-step throughput improvement for Llama-7B: torch.compile → INT8 quantization → INT4 quantization → speculative decoding; Figure 9-14 throughput improvement chart

## Inference Service Optimization

- Service-level optimization as resource management for fixed resources and dynamic workloads
- Key distinction from model-level: service-level techniques do not modify models or outputs

### Batching

- Batching rationale: processing multiple simultaneous requests together to reduce cost
- Bus analogy: batching moves more people but can lengthen individual journeys
- Three batching techniques: static, dynamic, continuous

- Static batching: fixed batch size, waits until full before processing
- Dynamic batching: maximum time window per batch, processes at capacity or timeout
- Figure 9-15: comparison of static and dynamic batching with latency implications
- Naive batching problem for LLMs: short responses waiting for long responses to complete
- Continuous batching (in-flight batching): returning responses as completed, filling slots immediately
- Orca paper (Yu et al., 2022) as origin of continuous batching
- Figure 9-16: continuous batching diagram showing immediate response return and slot refill

### Decoupling prefill and decode

- Prefill (compute-bound) and decode (memory bandwidth-bound) competition for resources
- Problem: adding a new prefill job drains resources from existing decode jobs, increasing TPOT
- Disaggregated prefill/decode in DistServe and "Inference Without Interference" papers
- Communication overhead acceptability via high-bandwidth GPU cluster connections (NVLink)
- Prefill-to-decode instance ratio depending on workload characteristics and latency priorities
- Example ratios: 2:1 to 4:1 for long inputs with low-TTFT priority; 1:2 to 1:1 for short inputs

### Prompt caching

- Prompt cache rationale: storing overlapping prompt segments for reuse across queries
- Common overlap: system prompt reuse across every query
- Use cases: long documents queried by many users, long conversation histories
- Figure 9-17: prompt cache visualization showing overlapping segment reuse
- Scale of savings: 1,000-token system prompt × 1M daily calls = 1B cached tokens per day
- Memory cost of prompt caches as a trade-off
- Google Gemini pricing: 75% discount on cached tokens with $1.00/1M tokens/hour storage fee
- Anthropic prompt caching: up to 90% cost savings, up to 75% latency reduction
- Table 9-3: cost and latency reduction from prompt caching across three use cases

### Parallelism

- Parallelism as the backbone of high-performance computing for accelerators
- Two broadly applicable families: data parallelism and model parallelism; plus context and sequence parallelism for LLMs
- Replica parallelism: creating multiple model copies; bin-packing complexity with mixed model sizes and GPU capacities
- Example bin-packing problem with 8B/13B/34B/70B models and 24/40/48/80 GB GPUs
- Model parallelism: splitting a single model across multiple machines when it cannot fit on one

- Tensor parallelism (intra-operator parallelism): partitioning tensors across devices for parallel operator execution
- Tensor parallelism benefits: serving large models, reduced latency; cost: communication overhead
- Figure 9-18: tensor parallelism for matrix multiplication split columnwise
- Pipeline parallelism: dividing model computation into stages across devices with micro-batching
- Figure 9-19: four-machine pipeline parallelism with micro-batch flow
- Pipeline parallelism trade-off: increased per-request latency due to inter-stage communication; preferred for training
- Context parallelism: splitting the input sequence itself across devices
- Sequence parallelism: splitting operators for the full input across machines

## Summary

- A model's usability depending heavily on inference cost and latency
- Chapter recap: efficiency metrics for latency (TTFT, TPOT), throughput, and utilization
- Cost-latency trade-off recap: reducing latency typically increases cost and vice versa
- AI hardware overview as prerequisite for deep optimization
- Applicability of inference techniques to application developers using APIs
- Model-level optimization changing model behavior vs. service-level keeping the model intact
- Model-level techniques: quantization, distillation, attention optimization, KV cache, kernels, autoregressive decoding solutions
- Service-level techniques: batching, parallelism, prefill/decode decoupling, prompt caching
- Workload-dependent technique selection: KV caching for long context; prompt caching for overlapping prompts; replica parallelism for low latency
- Most impactful broadly applicable techniques: quantization, tensor parallelism, replica parallelism, attention mechanism optimization

---

# Chapter 10: AI Engineering Architecture and User Feedback

- Chapter purpose: bringing together techniques from previous chapters to build successful products
- Gradual architecture approach: start simple, add components to address emergent challenges
- User feedback's dual role: evaluating performance and serving as data for model improvement
- Conversational interface as both an easier feedback channel and a harder signal extraction problem

## AI Engineering Architecture

- The architecture described as validated across multiple companies for a wide range of applications
- Simplest architecture: query → model → response, no context augmentation, no guardrails
- Figure 10-1: simplest AI application architecture
- Five-step progression for adding components: context, guardrails, router/gateway, caching, agent patterns
- Monitoring and observability deferred until after the pipeline is established
- Orchestration discussed after monitoring

### Step 1. Enhance Context

- Context enhancement as the first typical platform expansion
- Retrieval mechanisms: text, image, and tabular data retrieval
- Tool-based context augmentation: web search, news, weather, events APIs
- Context construction as feature engineering for foundation models
- Universal support for context construction among major model API providers
- Differences across providers: document upload limits, retrieval algorithms, chunk size configurations, tool execution modes
- Figure 10-2: architecture with context construction added

### Step 2. Put in Guardrails

- Guardrails as risk mitigators placed wherever exposures exist
- Two categories: input guardrails and output guardrails

#### Input guardrails

- Two input risks: leaking private information to external APIs and executing bad prompts
- Chapter 5 reference for prompt hack defenses and the irreducible nature of risk
- Scenarios causing private information leakage to external APIs: employee prompts, system prompts, tool retrieval
- No airtight prevention for third-party API leaks; mitigation via sensitive data detection
- Common sensitive data classes: personal information, human faces, IP-related keywords
- Two responses to detected sensitive data: block the query or mask the information
- PII reverse dictionary for unmasking: Figure 10-3 masking/unmasking PII flow

#### Output guardrails

- Two output guardrail functions: catching failures and specifying failure-handling policies
- Easiest failure to detect: empty response
- Quality failures: malformatted response, factually inconsistent (hallucination), generally bad
- Security failures: toxic content, private information in output, code execution triggers, brand-risk content
- Importance of tracking false refusal rate alongside security failures
- Retry logic for probabilistic models: retrying on empty or malformatted responses
- Latency cost of sequential retries; parallel redundant calls as a latency mitigation
- Human fallback for tricky requests: keyword-based transfer, sentiment-based transfer, turn-count-based transfer

#### Guardrail implementation

- Reliability vs. latency trade-off: some teams skip guardrails to preserve latency
- Output guardrails' incompatibility with streaming mode: partial responses shown before evaluation
- Self-hosted models reducing the need for some input guardrails
- Multi-level guardrail implementation: model providers, application developers, standalone solutions
- Off-the-shelf guardrail solutions: Meta's Purple Llama, NVIDIA's NeMo Guardrails, Azure PyRIT, Perspective API, OpenAI content moderation
- Figure 10-4: application architecture with input and output guardrails added

### Step 3. Add Model Router and Gateway

#### Router

- Multi-model routing benefits: specialization for specific query types, cost savings via cheaper models for simple queries
- Intent classifier as the core of a router
- Customer support chatbot routing examples: FAQ redirect, human operator, specialized troubleshooting bot
- Intent classifier preventing out-of-scope conversations with stock responses
- Ambiguous query detection and clarification requests via intent classifier
- Next-action predictors for agents: code interpreter vs. search API selection
- Memory hierarchy routing: in-document vs. internet search decision
- Implementation options: adapted smaller LMs (GPT-2, BERT, Llama 7B) or trained-from-scratch classifiers
- Speed and cost requirements for routers: lightweight to avoid latency and cost overhead
- Context limit adjustment when routing to models with varying context sizes
- Figure 10-5: architecture with routing added; routers grouped inside Model API box
- Common AI application pattern: routing → retrieval → generation → scoring

#### Gateway

- Model gateway definition: intermediate layer providing unified, secure interface to multiple models
- Unified interface benefit: updating one gateway instead of all dependent applications on API change
- Figure 10-6: model gateway high-level visualization
- Gateway as a unified wrapper: code example showing openai_model and gemini_model under one endpoint
- Access control and cost management: centralized API key management with fine-grained access controls
- API usage monitoring and rate-limiting to prevent abuse
- Fallback policies for rate limits and API failures: routing to alternatives, retrying, graceful degradation
- Additional gateway functionalities: load balancing, logging, analytics, caching, guardrails
- Off-the-shelf gateway examples: Portkey, MLflow AI Gateway, LLM Gateway, TrueFoundry, Kong, Cloudflare
- Figure 10-7: architecture with routing and gateway modules

### Step 4. Reduce Latency with Caches

- System caching as distinct from inference caching (KV cache, prompt cache covered in Chapter 9)
- Two major system caching mechanisms: exact caching and semantic caching

#### Exact caching

- Exact cache operation: cache hit only on exact match; miss triggers computation and caching
- Exact caching for embedding-based retrieval: avoiding redundant vector search
- Special appeal for multi-step queries with time-consuming actions
- Implementation options: in-memory storage, PostgreSQL, Redis, or tiered storage
- Eviction policies: LRU, LFU, FIFO
- Cache duration considerations: user-specific and time-sensitive queries should not be cached
- Classifier-based cache prediction for query cacheability

> **Exact caching data leak risk** — cached response containing user-specific information returned to a different user; importance of not treating personalized responses as generic

#### Semantic caching

- Semantic cache operation: cached items reused for semantically similar (not identical) queries
- Example: "What's the capital of Vietnam?" reused for "What's the capital city of Vietnam?"
- Higher hit rate and cost reduction potential vs. quality reduction risk
- Semantic similarity mechanism: embedding generation → vector search → similarity threshold check
- Vector database requirement for storing query embeddings
- Reliability risks: dependency on embedding quality, vector search accuracy, similarity metric, threshold tuning
- Computational cost of semantic caching: vector search overhead
- Conditions under which semantic caching is worthwhile: high cache hit rate
- Figure 10-8: architecture with caches added

### Step 5. Add Agent Patterns

- From sequential flows to complex loops, parallel execution, and conditional branching
- Agentic loop example: inadequate response triggers additional retrieval and re-generation
- Figure 10-9: yellow arrow enabling generated responses to feed back into the system
- Write actions enabling direct environment modification: email composition, orders, bank transfers
- Risks of write actions requiring utmost care
- Figure 10-10: architecture with write actions added
- Complexity growth: more components → more failure modes → harder debugging

### Monitoring and Observability

- Observability as integral to product design, not an afterthought
- Focus on what is unique to foundation model applications vs. established general observability best practices
- Monitoring goal: mitigating risks (failures, security attacks, drifts) and discovering opportunities
- Three DevOps-derived observability quality metrics: MTTD, MTTR, CFR
- High CFR as a signal to redesign the evaluation pipeline
- Evaluation and monitoring working together: metrics should translate across phases

> **Monitoring Versus Observability** — monitoring: inferring internal state from external outputs; observability: internal states *can* be inferred from external outputs without new code deployment; book's usage convention

#### Metrics

- Metrics as tools to detect failures and identify improvement opportunities, not ends in themselves
- Failure-mode-driven metric design: design metrics around the failures you want to catch
- Metric categories: format failures (easiest), generation quality (factual consistency, conciseness), safety (toxicity, PII, guardrail trigger rates)
- User behavior metrics: early generation stops, turns per conversation, input/output token lengths, output token distribution diversity
- Length-related metrics as proxies for latency and cost
- Per-component metrics in RAG: context relevance, context precision, vector database storage and query time
- Business north star correlation: DAU, session duration, subscriptions as targets; using metric correlations for prioritization
- Latency metrics: TTFT, TPOT, total latency per user for scale evaluation
- Cost metrics: query volume, input/output tokens per second, requests per second for rate limit monitoring
- Spot checks vs. exhaustive checks; combination strategy
- Metric breakdowns by axis: users, releases, prompt/chain versions, prompt types, time

#### Logs and traces

- Metrics as aggregated summaries vs. logs as append-only event records
- Production debugging workflow: metrics alert → log investigation → error correlation
- Latency requirements for logs: must be readily available for fast response (not 15-minute delayed)
- General rule: log everything — configurations, prompt templates, queries, outputs, tool calls, timestamps, component lifecycle events
- Log tagging and ID assignment for source attribution
- AI-powered log analysis tools for managing log volume growth
- Daily manual log inspection for developer calibration (Shankar et al., 2024 finding)
- Traces as linked event sequences forming a complete transaction timeline
- Trace content: query → actions → retrieved documents → final prompt → response, with timing and cost per step
- Figure 10-11: request trace visualization in LangSmith
- Ideal trace capability: pinpointing exact failure step in a query's path

#### Drift detection

- Sources of change in complex AI applications
- System prompt changes: template updates, coworker edits; simple logic sufficient to detect
- User behavior changes: users adapting to technology over time causing gradual metric shifts
- Underlying model changes: API-level model updates not always disclosed by providers; Chen et al. (2023) GPT-4 benchmark differences; Voiceflow's 10% drop on GPT-3.5-turbo version switch

### AI Pipeline Orchestration

- Orchestrator definition: specifies how components work together to create an end-to-end pipeline
- Two high-level orchestrator operations: components definition and chaining
- Components definition: registering models, data sources, tools, and evaluation/monitoring integrations
- Chaining as function composition: specifying sequential steps from raw query to final response
- Six-step chaining example: process query → retrieve data → combine context → generate → evaluate → route or return
- Orchestrator responsibility: passing data between components and notifying on data flow failures

> **AI pipeline orchestrator vs. general workflow orchestrator** — AI pipeline orchestrators differ from Airflow or Metaflow; the distinction matters for choosing the right tool

- Parallel execution guidance for latency-sensitive pipelines: routing and PII removal done simultaneously
- Available orchestration tools: LangChain, LlamaIndex, Flowise, Langflow, Haystack
- Advice to start without an orchestrator to avoid abstraction hiding critical system details
- Three evaluation criteria for choosing an orchestrator: integration/extensibility, complex pipeline support, ease-of-use/performance/scalability

## User Feedback

- User feedback's two key roles: evaluating performance and informing development
- User feedback as proprietary data powering the data flywheel (Chapter 8)
- First-mover advantage: early launch → user data → continuous model improvement → competitive moat
- Privacy obligations: user data rights and transparency about data usage

### Extracting Conversational Feedback

- Explicit vs. implicit feedback: thumbs up/down, star ratings vs. inferred from user actions
- Conversational interface making feedback easier to give but harder to extract
- Example: hotel recommendation conversation revealing art preference and budget sensitivity
- Three uses of extracted conversational feedback: evaluation, development, personalization
- Challenges of implicit conversational feedback: blended into dialogue, requires rigorous analysis
- History of conversational feedback research pre-ChatGPT: RL from natural language feedback, Alexa, Spotify, Yahoo Voice

#### Natural language feedback

- Definition: feedback extracted from message content

##### Early termination

- Early termination as a signal of poor conversation quality: stopping generation, exiting, telling model to stop, not responding

##### Error correction

- "No, …" or "I meant, …" phrasing as indicators of off-target responses
- Rephrase attempts as error correction signals detectable via heuristics or ML models
- Figure 10-12: example of early termination + rephrase signaling model misunderstanding
- Specific correction feedback: "Bill is the suspect, not the victim" example
- Action-correcting feedback in agentic use cases: "Check XYZ GitHub page"
- Explicit confirmation requests: "Are you sure?", "Check again", "Show me the sources"
- User edits to model output as strong failure signal and source of preference data
- User edits as preference finetuning data: original = losing response, edited = winning response

##### Complaints

- General negative expressions without correction attempts
- Table 10-1: eight feedback groups from automatic clustering of FITS dataset (Xu et al., 2022) with percentages

##### Sentiment

- General negative sentiment (frustration, disappointment) as a conversation-quality proxy
- Call center voice analysis analogy: increasing loudness signals problems; anger-to-happiness arc signals resolution
- Model refusal rate ("Sorry, I don't know that one") as an implicit negative feedback signal

#### Other conversational feedback

##### Regeneration

- Regeneration as potential dissatisfaction signal vs. curiosity for options
- Stronger regeneration signal with usage-based billing than subscriptions
- Regeneration for consistency checking in complex requests
- Figure 10-13: ChatGPT's comparative feedback request after regeneration
- Comparative regeneration data as preference finetuning material

##### Conversation organization

- Delete, rename, share, bookmark actions as signals with varying strengths
- Deletion as strong negative signal (unless privacy-motivated)
- Renaming suggesting good conversation but bad auto-generated title

##### Conversation length

- Turns per conversation interpreted differently by application type
- Long conversations in AI companions = engagement; in support bots = inefficiency

##### Dialogue diversity

- Distinct token or topic count measuring dialogue diversity
- Long conversation with repeated lines indicating a stuck loop

- Explicit feedback easier to interpret but sparse and subject to response biases
- Implicit feedback abundant but noisy; interpretation requires user study
- Combining signals improves clarity: rephrase after link sharing suggests disappointment
- Implicit conversational feedback extraction as a small but growing research area

### Feedback Design

#### When to collect feedback

- Feedback collection throughout the user journey; nonintrusive; should not disrupt workflow

##### In the beginning

- Calibration feedback on sign-up: face ID scanning, voice recognition training, skill-level assessment
- Calibration necessity vs. optionality; fallback to neutral default with gradual calibration over time

##### When something bad happens

- Failure notification mechanisms: downvote, regenerate, model switch options
- Conversational failure feedback: "You're wrong", "Too cliche", "I want something shorter"
- Letting users collaborate with AI (edit category) or with humans (customer support transfer)
- Inpainting for image generation as a human-AI collaboration feedback example
- Figure 10-14: DALL-E inpainting example

##### When the model has low confidence

- Presenting two summary versions side by side when uncertain; comparative signal for preference finetuning
- Figure 10-15: ChatGPT side-by-side response comparison
- Full vs. partial response comparison trade-offs for feedback reliability
- Figure 10-16: Google Gemini partial response side-by-side for comparative feedback
- Google Photos face grouping as low-confidence feedback request example
- Figure 10-17: Google Photos uncertain face-matching feedback prompt
- Apple's human interface guideline warning against asking for both positive and negative feedback
- Argument for collecting positive feedback: reveals high-impact features worth concentrating on
- Managing feedback request frequency: show to 1% of users; risk of bias in small samples

#### How to collect feedback

- Seamless feedback integration: easy to give, non-disruptive, easy to ignore, incentivized
- Midjourney as good feedback design example: four images with upscale/variation/regenerate options
- Figure 10-18: Midjourney workflow implicit feedback signals (upscale = strong positive, variation = weak positive, regenerate = none good)
- GitHub Copilot Tab-to-accept / continue-typing-to-ignore as frictionless binary signal
- Figure 10-19: GitHub Copilot suggestion in lighter color
- Standalone AI apps vs. integrated products: ChatGPT doesn't know if generated email was sent; Gmail tracks draft usage
- Thumbs up/down usefulness for product analytics; need for conversational context for deeper analysis
- Consent and data donation flow for feedback-with-context collection
- Transparency about how feedback is used as a motivator for higher quality contributions
- Not asking users to do the impossible: avoid ambiguous comparative questions
- Figure 10-20: ChatGPT asking preference between two statistical answers user cannot evaluate
- UI clarity: icons, tooltips; risk of ambiguous design causing noisy feedback
- Figure 10-21: Luma emoji ordering error causing confused ratings
- Private vs. public signals: effect on user candor, discoverability, and explainability
- X (Twitter) making likes private in 2024 and reported increase in like volume
- Downside of private signals: reduced discoverability and recommendation explainability

### Feedback Limitations

#### Biases

- Overview: each application has its own feedback biases; important to understand and design around them
- Leniency bias: tendency to rate positively to avoid conflict or extra work; Uber 4.8 average driver rating example
- Leniency bias mitigation: replacing numeric scales with descriptive phrases to reduce strong negative connotation
- Randomness: users providing random feedback from lack of motivation to engage deeply
- Position bias: users more likely to click first suggestion regardless of quality; mitigation via random position variation or position-aware modeling
- Preference bias: length bias in side-by-side comparisons; recency bias in sequential answer evaluation
- Imperative to inspect feedback to uncover biases and interpret correctly

#### Degenerate feedback loop

- User feedback incompleteness: only feedback on what is shown
- Degenerate feedback loop mechanism: predictions influence feedback, which influences next model iteration, amplifying initial biases
- Video recommendation exposure bias example: slightly higher-ranked video gets more clicks, perpetuating its dominance
- Cat photo amplification example illustrating how feedback loops narrow product focus and attract homogeneous user base
- Risk of sycophancy: models trained on user feedback learn to tell users what they want to hear (Sharma et al., 2023)
- Conclusion: understand feedback limitations and potential impact before incorporating it into product

## Summary

- Chapter as a holistic look at building AI applications, beyond individual technique chapters
- Two-part structure: common architecture and user feedback design
- Architecture as a framework for understanding component fit, not a rigid prescription
- Fluid component separation: guardrails can live in inference service, model gateway, or standalone
- Additional components increasing capability and safety but also complexity and new failure modes
- Monitoring and observability as integral to complex system design
- Conversational interface enabling new feedback types for analytics, improvement, and data flywheel
- AI engineers increasingly involved in feedback design due to data flywheel's competitive importance
- AI challenges as system problems requiring holistic understanding of all components

---

# Epilogue

- Acknowledgment of the book's scope: 150,000+ words, 160 illustrations, 250 footnotes, 975 references
- Gratitude for the opportunity to learn and to the reader for their time
- Hardest part of technical writing: asking the right questions, not finding correct answers
- Hope that the book sparked useful questions for the reader
- Invitation to discuss use cases and reach out via X, LinkedIn, or email
- Pointer to book's GitHub repository for additional AI engineering resources
- Closing encouragement to build and keep learning
