# Normalized Concepts: AI Engineering Ch. 9–10

## Inference Fundamentals

### Inference Optimization Overview
- **summary**: The practice of making AI model inference faster and cheaper across model, hardware, and service levels.
- **source**: Ch9 > Chapter 9: Inference Optimization
- **merged_from**:
  - The central importance of making models faster and cheaper alongside better
  - Three levels of inference optimization: model, hardware, and service
  - Inference as an interdisciplinary field spanning researchers, engineers, and hardware architects
  - Value of understanding inference optimization even when using third-party APIs
  - Three levels of inference optimization: model (arrows), hardware (archer), service (shooting process)

### Training vs. Inference Lifecycle
- **summary**: The two distinct phases of an AI model's lifecycle with different computational and operational characteristics.
- **source**: Ch9 > Understanding Inference Optimization
- **merged_from**:
  - The two phases of an AI model lifecycle: training versus inference

### Inference Server and Service Architecture
- **summary**: An inference server handles model execution within a broader service that receives and responds to queries.
- **source**: Ch9 > Understanding Inference Optimization > Inference Overview
- **merged_from**:
  - Definition of an inference server and its role in a broader inference service
  - Model APIs as inference services and the responsibility of self-hosted model operators

### Computational Bottleneck Types
- **summary**: Two primary bottleneck categories — compute-bound and memory bandwidth-bound — that determine which optimizations apply.
- **source**: Ch9 > Understanding Inference Optimization > Inference Overview > Computational bottlenecks
- **merged_from**:
  - Definition and framing of optimization as identifying and addressing bottlenecks
  - Two main computational bottleneck types: compute-bound and memory bandwidth-bound
  - Compute-bound definition and example (password decryption)
  - Memory bandwidth-bound definition and example (CPU-to-GPU data transfer)
  - Terminology Ambiguity: Memory-Bound Versus Bandwidth-Bound — distinction between memory-capacity-bound (OOM errors) and memory-bandwidth-bound
  - Optimization technique selection based on bottleneck type


### Prefill and Decode Steps in Autoregressive Inference
- **summary**: The two computational phases of autoregressive LLM inference with distinct bottleneck profiles — compute-bound prefill and memory bandwidth-bound decode.
- **source**: Ch9 > Understanding Inference Optimization > Inference Overview > Computational bottlenecks
- **merged_from**:
  - Different bottleneck profiles across model architectures (Stable Diffusion vs. autoregressive LMs)
  - Prefill step as compute-bound due to parallel token processing
  - Decode step as memory bandwidth-bound due to large matrix loading
  - Decoupling prefill and decode in production as a consequence of differing computational profiles
  - Factors affecting LLM inference bottlenecks: context length, output length, batching strategy
  - Current predominance of memory bandwidth-bound AI workloads and the future outlook

### Online vs. Batch Inference APIs
- **summary**: Two API modes optimized for different goals — online for low latency and batch for cost efficiency with higher turnaround time.
- **source**: Ch9 > Understanding Inference Optimization > Inference Overview > Online and batch inference APIs
- **merged_from**:
  - Two API types: online (latency-optimized) versus batch (cost-optimized)
  - Batch API cost savings example: 50% discount at Gemini and OpenAI with higher turnaround time
  - Online APIs still batching requests when it does not significantly impact latency
  - Customer-facing use cases suited to online APIs versus use cases suited to batch APIs
  - List of batch-suitable workloads: synthetic data, reporting, onboarding, model migration, recommendations, knowledge base updates
  - Batch API for Foundation Models vs. Traditional ML — distinction between foundation model batch APIs and traditional ML batch inference

### Streaming Mode
- **summary**: A response delivery mode that returns tokens as they are generated, reducing perceived time to first token.
- **source**: Ch9 > Understanding Inference Optimization > Inference Overview > Online and batch inference APIs
- **merged_from**:
  - Streaming mode: returning tokens as generated to reduce time to first token
  - Risk of streaming: inability to score responses before user sees them

## Inference Performance Metrics

### Latency Metrics (TTFT and TPOT)
- **summary**: Key user-facing latency measures including time to first token, time per output token, and total response latency.
- **source**: Ch9 > Inference Performance Metrics > Latency, TTFT, and TPOT
- **merged_from**:
  - Latency definition: time from query send to complete response receipt
  - Time to first token (TTFT): duration of prefill step, application-dependent expectations
  - Time per output token (TPOT): per-token generation speed after first token
  - Human reading speed benchmark: ~120 ms/token (6–8 tokens/second) as TPOT target
  - Time between tokens (TBT) and inter-token latency (ITL) as related metrics
  - Total latency formula: TTFT + TPOT × (number of output tokens)
  - Trade-off between TTFT and TPOT user experience and the role of user studies

### Latency in Agentic Contexts
- **summary**: In agentic or CoT applications, user-observed latency differs from model-side latency, requiring metrics like "time to publish."
- **source**: Ch9 > Inference Performance Metrics > Latency, TTFT, and TPOT
- **merged_from**:
  - TTFT and TPOT as observed by models versus observed by users in CoT/agentic contexts
  - "Time to publish" metric for agentic applications where intermediate steps are hidden
  - Three-step agentic scenario illustrating the gap between model-side and user-side TTFT

### Latency Distribution and Percentile Analysis
- **summary**: Latency should be analyzed as a distribution using percentiles (p50, p90, p95, p99) because outliers skew averages.
- **source**: Ch9 > Inference Performance Metrics > Latency, TTFT, and TPOT
- **merged_from**:
  - Latency as a distribution: how outliers skew the average and the need for percentile analysis
  - Recommended percentiles for latency monitoring: p50, p90, p95, p99

### Throughput Metrics
- **summary**: Measures of system output capacity including tokens per second and requests per second, directly linked to compute cost.
- **source**: Ch9 > Inference Performance Metrics > Throughput and goodput
- **merged_from**:
  - Throughput definition: output tokens per second across all users and requests
  - Input vs. output token throughput counted separately due to differing computational profiles
  - Tokens per second (TPS) and tokens/s/user as throughput metrics
  - Requests per second (RPS) and requests per minute (RPM) for request-level throughput
  - Rate limit implications of high concurrent request volumes
  - Throughput's direct link to compute cost; example cost calculations for decoding and prefilling
  - Factors affecting what constitutes good throughput: model size, hardware, workload consistency
  - Tokenizer differences making direct throughput comparisons approximate
  - Latency/throughput trade-off: potential to double or triple throughput at the cost of latency

### Goodput
- **summary**: The subset of throughput that satisfies a service level objective (SLO), representing truly useful capacity.
- **source**: Ch9 > Inference Performance Metrics > Throughput and goodput
- **merged_from**:
  - Goodput definition: requests per second satisfying the SLO

### GPU Utilization and nvidia-smi
- **summary**: The nvidia-smi utilization metric measures time the GPU is active, not efficiency — active does not equal efficient.
- **source**: Ch9 > Inference Performance Metrics > Utilization, MFU, and MBU
- **merged_from**:
  - General definition of utilization metrics as proportion of resource actively used
  - GPU utilization in nvidia-smi: percentage of time GPU is actively processing, not efficiency
  - The problem with nvidia-smi's utilization metric: active ≠ efficient

### MFU (Model FLOP/s Utilization)
- **summary**: The ratio of observed computational throughput to theoretical peak FLOP/s, measuring how efficiently a model uses hardware.
- **source**: Ch9 > Inference Performance Metrics > Utilization, MFU, and MBU
- **merged_from**:
  - MFU (Model FLOP/s Utilization): ratio of observed throughput to theoretical peak throughput
  - MFU example calculation on A100-80GB
  - Linear relationship between throughput and both MBU and MFU
  - What constitutes good MFU and MBU depending on workload type
  - MFU comparison: training vs. inference, prefill vs. decode
  - Utilization as an efficiency indicator, not the ultimate goal; what truly matters is cost and speed

### MBU (Model Bandwidth Utilization)
- **summary**: The percentage of theoretical memory bandwidth actively used, indicating how efficiently memory is leveraged during inference.
- **source**: Ch9 > Inference Performance Metrics > Utilization, MFU, and MBU
- **merged_from**:
  - MBU (Model Bandwidth Utilization): percentage of theoretical memory bandwidth used
  - MBU formula and example calculation for Llama 2 7B in FP16
  - Quantization's impact on MBU via reduced bytes per parameter

## AI Accelerators

### AI Accelerator Landscape
- **summary**: Specialized chips designed for AI workloads, dominated by NVIDIA GPUs but including AMD, Google TPU, Intel Gaudi, and others.
- **source**: Ch9 > AI Accelerators > What's an accelerator?
- **merged_from**:
  - Definition of an accelerator as a chip for specific computational workloads
  - GPU dominance and NVIDIA's economic role in the early 2020s AI boom
  - Survey of AI accelerator landscape: AMD GPUs, Google TPU, Intel Gaudi, Graphcore IPU, Groq LPU, Cerebras QPU
  - Interdependence of AI model development and hardware development throughout history
  - AlexNet (2012) and the GPU as the catalyst for the deep learning research boom

### CPU vs. GPU Design Philosophy
- **summary**: CPUs optimize for single-thread sequential performance while GPUs use thousands of smaller cores for massively parallel workloads.
- **source**: Ch9 > AI Accelerators > What's an accelerator?
- **merged_from**:
  - CPU vs. GPU design philosophy: general-purpose vs. parallel processing
  - CPU characteristics: few powerful cores, single-thread excellence, sequential tasks
  - GPU characteristics: thousands of smaller cores, matrix multiplication, parallelizable ML workloads
  - Challenges of parallel processing on memory design and power consumption

### Inference vs. Training Chip Design
- **summary**: Inference chips prioritize latency, lower precision, and memory efficiency, while training chips emphasize throughput and high precision.
- **source**: Ch9 > AI Accelerators > What's an accelerator?
- **merged_from**:
  - Inference vs. training cost distribution: inference can exceed training cost and accounts for up to 90% of deployed ML costs
  - Training vs. inference chip design differences: memory, precision, and latency priorities
  - Inference-specialized chip examples: Apple Neural Engine, AWS Inferentia, MTIA, Edge TPU, Jetson Xavier
  - Chips specialized for transformer architecture and the trend toward consumer device chips

### Compute Primitives Across Hardware
- **summary**: Different hardware architectures operate on scalar, vector, or tensor compute primitives, affecting their suitability for AI workloads.
- **source**: Ch9 > AI Accelerators > What's an accelerator?
- **merged_from**:
  - Three main chip characteristics that matter across use cases: FLOP/s, memory, power
  - Mixing compute units in modern chips: GPU tensor cores vs. TPU tensor-primary design

### Accelerator Computational Capabilities (FLOP/s)
- **summary**: FLOP/s measures peak computational throughput; actual achievable FLOP/s depends on numerical precision and utilization.
- **source**: Ch9 > AI Accelerators > What's an accelerator? > Computational capabilities
- **merged_from**:
  - FLOP/s as the standard metric for computational capability
  - The gap between peak FLOP/s and achievable FLOP/s; utilization as the ratio
  - Numerical precision's effect on operations per second: higher precision → fewer ops

### GPU Memory Hierarchy
- **summary**: AI accelerator systems have three memory levels — CPU DRAM, GPU HBM, and GPU on-chip SRAM — each with distinct bandwidth and capacity trade-offs.
- **source**: Ch9 > AI Accelerators > What's an accelerator? > Memory size and bandwidth
- **merged_from**:
  - Why GPU memory needs higher bandwidth than CPU memory: parallel core data movement
  - CPU DDR SDRAM (2D structure) vs. GPU HBM (3D stacked structure)
  - Three levels of memory in an AI accelerator system: CPU DRAM, GPU HBM, GPU on-chip SRAM
  - CPU DRAM characteristics: lowest bandwidth (25–50 GB/s), largest capacity (16 GB–1 TB+)
  - GPU HBM characteristics: high bandwidth (256 GB/s–1.5 TB/s), 24–80 GB capacity
  - GPU on-chip SRAM characteristics: extremely high speed (>10 TB/s), small size (≤40 MB)
  - GPU optimization as an exercise in exploiting the memory hierarchy
  - Low-level GPU programming languages: CUDA, OpenAI's Triton, ROCm

### Accelerator Power Consumption
- **summary**: Transistor switching causes heat and energy use; electricity has become a bottleneck to scaling AI compute infrastructure.
- **source**: Ch9 > AI Accelerators > What's an accelerator? > Power consumption
- **merged_from**:
  - Transistor switching as the source of energy consumption and heat generation
  - Annual energy consumption of an H100 at peak: ~7,000 kWh vs. 10,000 kWh average US household
  - Electricity as a bottleneck to scaling compute and data center location constraints
  - Maximum power draw vs. TDP as power consumption specifications
  - Cloud provider abstraction from cooling and electricity concerns

### Accelerator Selection Criteria
- **summary**: Choosing an accelerator requires matching workload type (compute-bound vs. memory-bound) to FLOP/s, memory size, and bandwidth.
- **source**: Ch9 > AI Accelerators > Selecting Accelerators
- **merged_from**:
  - Workload-based accelerator selection: compute-bound → more FLOP/s; memory-bound → more bandwidth
  - Three questions for chip evaluation: can it run the workload, how long, and at what cost
  - FLOP/s, memory size, and bandwidth as the three decisive numbers

## Model Optimization Techniques

### Foundation Model Resource Intensity
- **summary**: Foundation models are computationally expensive due to their large size, autoregressive decoding, and attention mechanism.
- **source**: Ch9 > Model Optimization
- **merged_from**:
  - Three resource-intensive characteristics of foundation models: size, autoregressive decoding, attention mechanism

### Model Compression Overview
- **summary**: Techniques including quantization, distillation, and pruning that reduce model size and computational requirements.
- **source**: Ch9 > Model Optimization > Model compression
- **merged_from**:
  - Overview of compression techniques: quantization, distillation, and pruning

### Pruning
- **summary**: A compression technique that removes model nodes or zeros out weights to create sparser, smaller models.
- **source**: Ch9 > Model Optimization > Model compression
- **merged_from**:
  - Pruning definition: removing nodes (architecture change) or zeroing out weights (sparsity)
  - Pruned model uses: as-is inference or further finetuning to restore performance
  - Pruning for architecture discovery and training pruned architectures from scratch
  - Impressive pruning research results: 90%+ non-zero parameter reduction without accuracy loss
  - Practical limitations of pruning: complexity, modest gains, hardware sparsity support issues

### Weight-Only Quantization
- **summary**: The most widely used compression approach, reducing model size by representing weights at lower numerical precision.
- **source**: Ch9 > Model Optimization > Model compression
- **merged_from**:
  - Weight-only quantization as the most popular and effective compression approach

### Knowledge Distillation
- **summary**: A training technique that trains a smaller student model to mimic a larger teacher model's behavior.
- **source**: Ch9 > Model Optimization > Model compression
- **merged_from**:
  - Distillation as a common alternative producing comparable small models

### Autoregressive Decoding Bottleneck
- **summary**: Sequential token generation is slow and costly; output tokens carry significantly higher latency cost than input tokens.
- **source**: Ch9 > Model Optimization > Overcoming the autoregressive decoding bottleneck
- **merged_from**:
  - Sequential token generation as slow and expensive: output tokens cost 2–4× input tokens
  - Anyscale finding: one output token has the same latency impact as 100 input tokens
  - Rapidly evolving techniques landscape for addressing this bottleneck

### Speculative Decoding
- **summary**: A technique where a small draft model generates candidate tokens that a larger target model verifies in parallel, reducing latency.
- **source**: Ch9 > Model Optimization > Overcoming the autoregressive decoding bottleneck > Speculative decoding
- **merged_from**:
  - Speculative decoding mechanism: draft model generates tokens, target model verifies in parallel
  - Step-by-step speculative decoding process: draft K tokens → parallel verification → accept longest subsequence → generate one extra token
  - Behavior when no draft tokens are accepted vs. when all are accepted (K+1 tokens)
  - Three reasons speculative decoding avoids latency penalties: verification is parallelizable, easy tokens are predictable, idle decode FLOPs absorb verification cost
  - Acceptance rate characteristics: domain-dependent, higher for structured text like code
  - Draft model requirements: ideally same vocabulary and tokenizer as target
  - Popularity of speculative decoding: easy implementation, no quality change, integration into vLLM/TensorRT-LLM/llama.cpp

### Inference with Reference
- **summary**: A decoding speedup technique that copies tokens from input context instead of generating them, using the context as a draft source.
- **source**: Ch9 > Model Optimization > Overcoming the autoregressive decoding bottleneck > Inference with reference
- **merged_from**:
  - Core idea: copying tokens from input instead of generating them
  - Similarity to speculative decoding but using input context as draft source
  - Key challenge: algorithm to identify most relevant text span at each decoding step
  - Unlike speculative decoding: no extra model required but limited to output-context overlap scenarios
  - Use cases: retrieval systems, coding, multi-turn conversations

### Parallel Decoding
- **summary**: Techniques that break sequential token generation by producing multiple future tokens simultaneously using additional decoding heads or Jacobi iteration.
- **source**: Ch9 > Model Optimization > Overcoming the autoregressive decoding bottleneck > Parallel decoding
- **merged_from**:
  - Breaking sequential dependency: generating multiple future tokens simultaneously
  - Intuition for why it works: existing sequence often predicts several tokens ahead
  - Lookahead decoding (Fu et al., 2024): parallel tokens from the same decoder
  - Medusa (Cai et al., 2024): multiple decoding heads, each trained to predict a specific future position
  - Medusa training: heads trained alongside frozen original model
  - Jacobi decoding verification: generate K tokens, verify coherence, re-generate failed tokens
  - Medusa tree-based attention for verification: each head produces multiple options organized into a tree
  - Appeal vs. complexity of parallel decoding

### KV Cache
- **summary**: An inference optimization that stores and reuses key-value vectors from previous tokens to avoid recomputation at each decode step.
- **source**: Ch9 > Model Optimization > Attention mechanism optimization
- **merged_from**:
  - KV cache rationale: reusing key-value vectors to avoid recomputing them at each decode step
  - KV cache update mechanism: compute new K/V vectors for the latest token and append to cache
  - KV cache is inference-only — training processes all tokens at once, eliminating the need for incremental KV caching
  - Quadratic growth of attention computations vs. linear growth of KV cache with sequence length

### KV Cache Memory Bottleneck in Long-Context Serving
- **summary**: KV cache memory grows linearly with sequence length and batch size, becoming a primary bottleneck for long-context and large-batch inference.
- **source**: Ch9 > Model Optimization > Attention mechanism optimization
- **merged_from**:
  - KV cache memory at scale: 3 TB for a 500B+ model at batch size 512, context 2048
  - KV cache as a memory bottleneck for long-context applications and its latency impact
  - Calculating the KV Cache Size — formula: 2 × B × S × L × H × M with LLama 2 13B worked example

### Attention Mechanism Redesigns
- **summary**: Architectural modifications to attention — including local windowed, multi-query, grouped-query, and cross-layer attention — that reduce KV cache size.
- **source**: Ch9 > Model Optimization > Attention mechanism optimization > Redesigning the attention mechanism
- **merged_from**:
  - Constraint: architectural changes apply only during training or finetuning
  - Local windowed attention (Beltagy et al., 2020): attending to fixed-size window, 10× KV cache reduction example
  - Interleaving local and global attention: local for nearby context, global for task-specific information
  - Cross-layer attention (Brandon et al., 2024): sharing K/V vectors across adjacent layers, 3× KV cache reduction
  - Multi-query attention (Shazeer, 2019): sharing K/V vectors across query heads
  - Grouped-query attention (Ainslie et al., 2023): grouping query heads and sharing K/V within groups

### KV Cache Size Optimization Techniques
- **summary**: Runtime techniques including PagedAttention, quantization, and adaptive compression that reduce KV cache memory consumption during serving.
- **source**: Ch9 > Model Optimization > Attention mechanism optimization > Optimizing the KV cache size
- **merged_from**:
  - Memory bottleneck mitigation through KV cache management for large-batch long-context serving
  - PagedAttention in vLLM: non-contiguous blocks, reduced fragmentation, flexible memory sharing
  - Other KV cache techniques: quantization, adaptive compression, selective KV cache

### FlashAttention and Kernel-Level Attention Optimization
- **summary**: Hardware-aware kernel implementations like FlashAttention that fuse attention operators to reduce memory I/O and improve throughput.
- **source**: Ch9 > Model Optimization > Attention mechanism optimization > Writing kernels for attention computation
- **merged_from**:
  - Kernel writing approach: optimizing attention score computation for specific hardware
  - FlashAttention (Dao et al., 2022): fused operators for transformer computation

### GPU Kernels and Kernel Optimization Techniques
- **summary**: Specialized hardware-optimized code for repeated AI operations, written in CUDA or Triton using vectorization, parallelization, loop tiling, and operator fusion.
- **source**: Ch9 > Model Optimization > Kernels and compilers
- **merged_from**:
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

### Model Compilation and Lowering
- **summary**: The process of converting high-level model code into hardware-compatible instructions using compilers like torch.compile, XLA, or TensorRT.
- **source**: Ch9 > Model Optimization > Kernels and compilers
- **merged_from**:
  - Lowering: converting model code to hardware-compatible instructions; the role of compilers
  - Standalone compilers: Apache TVM, MLIR; integrated compilers: torch.compile, XLA, TensorRT

## Inference Service Optimization

### Inference Service Optimization Overview
- **summary**: Service-level techniques manage fixed resources and dynamic workloads without modifying models or their outputs.
- **source**: Ch9 > Inference Service Optimization
- **merged_from**:
  - Service-level optimization as resource management for fixed resources and dynamic workloads
  - Key distinction from model-level: service-level techniques do not modify models or outputs

### Static and Dynamic Batching
- **summary**: Request batching strategies that group multiple inference requests to improve hardware utilization, with static and dynamic variants.
- **source**: Ch9 > Inference Service Optimization > Batching
- **merged_from**:
  - Batching rationale: processing multiple simultaneous requests together to reduce cost
  - Static batching: fixed batch size, waits until full before processing
  - Dynamic batching: maximum time window per batch, processes at capacity or timeout
  - Naive batching problem for LLMs: short responses waiting for long responses to complete

### Continuous Batching
- **summary**: An in-flight batching technique that returns completed responses immediately and fills vacant slots with new requests, improving throughput.
- **source**: Ch9 > Inference Service Optimization > Batching
- **merged_from**:
  - Continuous batching (in-flight batching): returning responses as completed, filling slots immediately
  - Orca paper (Yu et al., 2022) as origin of continuous batching

### Prefill-Decode Disaggregation
- **summary**: Separating prefill and decode operations onto different hardware instances to prevent compute-bound prefill from degrading memory-bound decode latency.
- **source**: Ch9 > Inference Service Optimization > Decoupling prefill and decode
- **merged_from**:
  - Prefill (compute-bound) and decode (memory bandwidth-bound) competition for resources
  - Problem: adding a new prefill job drains resources from existing decode jobs, increasing TPOT
  - Disaggregated prefill/decode in DistServe and "Inference Without Interference" papers
  - Communication overhead acceptability via high-bandwidth GPU cluster connections (NVLink)
  - Prefill-to-decode instance ratio depending on workload characteristics and latency priorities

### Prompt Caching
- **summary**: A service-level technique that stores and reuses computed KV representations of overlapping prompt segments across queries.
- **source**: Ch9 > Inference Service Optimization > Prompt caching
- **merged_from**:
  - Prompt cache rationale: storing overlapping prompt segments for reuse across queries
  - Common overlap: system prompt reuse across every query
  - Use cases: long documents queried by many users, long conversation histories
  - Scale of savings: 1,000-token system prompt × 1M daily calls = 1B cached tokens per day
  - Memory cost of prompt caches as a trade-off
  - Google Gemini pricing: 75% discount on cached tokens with $1.00/1M tokens/hour storage fee
  - Anthropic prompt caching: up to 90% cost savings, up to 75% latency reduction

### Data Parallelism and Replica Parallelism
- **summary**: Scaling inference by creating multiple independent model replicas to handle increased request volume, with bin-packing complexity for mixed model sizes.
- **source**: Ch9 > Inference Service Optimization > Parallelism
- **merged_from**:
  - Parallelism as the backbone of high-performance computing for accelerators
  - Replica parallelism: creating multiple model copies; bin-packing complexity with mixed model sizes and GPU capacities

### Model Parallelism
- **summary**: Splitting a single model across multiple devices when it cannot fit on one, including tensor and pipeline parallelism strategies.
- **source**: Ch9 > Inference Service Optimization > Parallelism
- **merged_from**:
  - Model parallelism: splitting a single model across multiple machines when it cannot fit on one
  - Tensor parallelism (intra-operator parallelism): partitioning tensors across devices for parallel operator execution
  - Tensor parallelism benefits: serving large models, reduced latency; cost: communication overhead
  - Pipeline parallelism: dividing model computation into stages across devices with micro-batching
  - Pipeline parallelism trade-off: increased per-request latency due to inter-stage communication; preferred for training

### Context and Sequence Parallelism
- **summary**: LLM-specific parallelism techniques that split the input sequence or sequence-length operators across multiple devices.
- **source**: Ch9 > Inference Service Optimization > Parallelism
- **merged_from**:
  - Two broadly applicable families: data parallelism and model parallelism; plus context and sequence parallelism for LLMs
  - Context parallelism: splitting the input sequence itself across devices
  - Sequence parallelism: splitting operators for the full input across machines

## AI Engineering Application Architecture

### Gradual AI Application Architecture
- **summary**: A step-by-step architecture pattern starting with a simple query-model-response pipeline and progressively adding components to address emerging needs.
- **source**: Ch10 > AI Engineering Architecture
- **merged_from**:
  - The architecture described as validated across multiple companies for a wide range of applications
  - Simplest architecture: query → model → response, no context augmentation, no guardrails
  - Five-step progression for adding components: context, guardrails, router/gateway, caching, agent patterns
  - Monitoring and observability deferred until after the pipeline is established

### Context Enhancement and Retrieval
- **summary**: Augmenting model inputs with retrieved text, images, tabular data, or tool outputs to improve response quality.
- **source**: Ch10 > AI Engineering Architecture > Step 1. Enhance Context
- **merged_from**:
  - Context enhancement as the first typical platform expansion
  - Retrieval mechanisms: text, image, and tabular data retrieval
  - Tool-based context augmentation: web search, news, weather, events APIs
  - Context construction as feature engineering for foundation models
  - Universal support for context construction among major model API providers
  - Differences across providers: document upload limits, retrieval algorithms, chunk size configurations, tool execution modes

### Input Guardrails
- **summary**: Safety mechanisms applied to incoming queries to prevent private data leakage and malicious prompt injection.
- **source**: Ch10 > AI Engineering Architecture > Step 2. Put in Guardrails > Input guardrails
- **merged_from**:
  - Two input risks: leaking private information to external APIs and executing bad prompts
  - Scenarios causing private information leakage to external APIs: employee prompts, system prompts, tool retrieval
  - No airtight prevention for third-party API leaks; mitigation via sensitive data detection
  - Common sensitive data classes: personal information, human faces, IP-related keywords
  - Two responses to detected sensitive data: block the query or mask the information
  - PII reverse dictionary for unmasking

### Output Guardrails
- **summary**: Safety and quality checks on model outputs that detect failures — including hallucinations, toxicity, and malformatting — and specify handling policies.
- **source**: Ch10 > AI Engineering Architecture > Step 2. Put in Guardrails > Output guardrails
- **merged_from**:
  - Two output guardrail functions: catching failures and specifying failure-handling policies
  - Easiest failure to detect: empty response
  - Quality failures: malformatted response, factually inconsistent (hallucination), generally bad
  - Security failures: toxic content, private information in output, code execution triggers, brand-risk content
  - Importance of tracking false refusal rate alongside security failures
  - Retry logic for probabilistic models: retrying on empty or malformatted responses
  - Latency cost of sequential retries; parallel redundant calls as a latency mitigation
  - Human fallback for tricky requests: keyword-based transfer, sentiment-based transfer, turn-count-based transfer

### Guardrail Implementation Trade-offs
- **summary**: Implementing guardrails involves balancing reliability, latency, and streaming compatibility, with both off-the-shelf and custom solutions available.
- **source**: Ch10 > AI Engineering Architecture > Step 2. Put in Guardrails > Guardrail implementation
- **merged_from**:
  - Reliability vs. latency trade-off: some teams skip guardrails to preserve latency
  - Output guardrails' incompatibility with streaming mode: partial responses shown before evaluation
  - Self-hosted models reducing the need for some input guardrails
  - Multi-level guardrail implementation: model providers, application developers, standalone solutions
  - Off-the-shelf guardrail solutions: Meta's Purple Llama, NVIDIA's NeMo Guardrails, Azure PyRIT, Perspective API, OpenAI content moderation

### Model Router
- **summary**: A routing layer that uses an intent classifier to direct queries to the most appropriate model or action based on query type and cost.
- **source**: Ch10 > AI Engineering Architecture > Step 3. Add Model Router and Gateway > Router
- **merged_from**:
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

### Model Gateway
- **summary**: An intermediate layer providing a unified, secure interface to multiple model APIs with access control, monitoring, and fallback capabilities.
- **source**: Ch10 > AI Engineering Architecture > Step 3. Add Model Router and Gateway > Gateway
- **merged_from**:
  - Model gateway definition: intermediate layer providing unified, secure interface to multiple models
  - Unified interface benefit: updating one gateway instead of all dependent applications on API change
  - Gateway as a unified wrapper: code example showing openai_model and gemini_model under one endpoint
  - Access control and cost management: centralized API key management with fine-grained access controls
  - API usage monitoring and rate-limiting to prevent abuse
  - Fallback policies for rate limits and API failures: routing to alternatives, retrying, graceful degradation
  - Additional gateway functionalities: load balancing, logging, analytics, caching, guardrails
  - Off-the-shelf gateway examples: Portkey, MLflow AI Gateway, LLM Gateway, TrueFoundry, Kong, Cloudflare

### Exact Caching
- **summary**: A system-level cache returning stored responses only on exact query matches, suitable for repeated identical queries.
- **source**: Ch10 > AI Engineering Architecture > Step 4. Reduce Latency with Caches > Exact caching
- **merged_from**:
  - Exact cache operation: cache hit only on exact match; miss triggers computation and caching
  - Exact caching for embedding-based retrieval: avoiding redundant vector search
  - Special appeal for multi-step queries with time-consuming actions
  - Implementation options: in-memory storage, PostgreSQL, Redis, or tiered storage
  - Eviction policies: LRU, LFU, FIFO
  - Cache duration considerations: user-specific and time-sensitive queries should not be cached
  - Classifier-based cache prediction for query cacheability
  - Exact caching data leak risk — cached response containing user-specific information returned to a different user

### Semantic Caching
- **summary**: A cache that reuses stored responses for semantically similar queries using embedding-based vector search and a similarity threshold.
- **source**: Ch10 > AI Engineering Architecture > Step 4. Reduce Latency with Caches > Semantic caching
- **merged_from**:
  - Semantic cache operation: cached items reused for semantically similar (not identical) queries
  - Higher hit rate and cost reduction potential vs. quality reduction risk
  - Semantic similarity mechanism: embedding generation → vector search → similarity threshold check
  - Vector database requirement for storing query embeddings
  - Reliability risks: dependency on embedding quality, vector search accuracy, similarity metric, threshold tuning
  - Computational cost of semantic caching: vector search overhead
  - Conditions under which semantic caching is worthwhile: high cache hit rate

### Agentic Patterns in Application Architecture
- **summary**: Advanced pipeline patterns including loops, parallel execution, conditional branching, and write actions that enable agents to modify the environment.
- **source**: Ch10 > AI Engineering Architecture > Step 5. Add Agent Patterns
- **merged_from**:
  - From sequential flows to complex loops, parallel execution, and conditional branching
  - Agentic loop example: inadequate response triggers additional retrieval and re-generation
  - Write actions enabling direct environment modification: email composition, orders, bank transfers
  - Risks of write actions requiring utmost care
  - Complexity growth: more components → more failure modes → harder debugging

### AI Pipeline Monitoring and Observability
- **summary**: The practice of tracking system metrics, logs, and traces to detect failures, security attacks, and drift in foundation model applications.
- **source**: Ch10 > AI Engineering Architecture > Monitoring and Observability
- **merged_from**:
  - Observability as integral to product design, not an afterthought
  - Focus on what is unique to foundation model applications vs. established general observability best practices
  - Monitoring goal: mitigating risks (failures, security attacks, drifts) and discovering opportunities
  - Three DevOps-derived observability quality metrics: MTTD, MTTR, CFR
  - High CFR as a signal to redesign the evaluation pipeline
  - Monitoring Versus Observability — monitoring: inferring internal state from external outputs; observability: internal states can be inferred from external outputs without new code deployment

### AI Application Metrics Design
- **summary**: Designing metrics around specific failure modes — format, quality, safety, user behavior, cost, and latency — to detect issues and guide improvement.
- **source**: Ch10 > AI Engineering Architecture > Monitoring and Observability > Metrics
- **merged_from**:
  - Metrics as tools to detect failures and identify improvement opportunities, not ends in themselves
  - Failure-mode-driven metric design: design metrics around the failures you want to catch
  - Metric categories: format failures (easiest), generation quality (factual consistency, conciseness), safety (toxicity, PII, guardrail trigger rates)
  - User behavior metrics: early generation stops, turns per conversation, input/output token lengths, output token distribution diversity
  - Length-related metrics as proxies for latency and cost
  - Per-component metrics in RAG: context relevance, context precision, vector database storage and query time
  - Business north star correlation: DAU, session duration, subscriptions as targets
  - Latency metrics: TTFT, TPOT, total latency per user for scale evaluation
  - Cost metrics: query volume, input/output tokens per second, requests per second for rate limit monitoring
  - Metric breakdowns by axis: users, releases, prompt/chain versions, prompt types, time

### Logging and Tracing for AI Pipelines
- **summary**: Append-only event logs and linked trace sequences that enable production debugging and root-cause analysis in AI pipelines.
- **source**: Ch10 > AI Engineering Architecture > Monitoring and Observability > Logs and traces
- **merged_from**:
  - Metrics as aggregated summaries vs. logs as append-only event records
  - Production debugging workflow: metrics alert → log investigation → error correlation
  - Latency requirements for logs: must be readily available for fast response
  - General rule: log everything — configurations, prompt templates, queries, outputs, tool calls, timestamps, component lifecycle events
  - Log tagging and ID assignment for source attribution
  - AI-powered log analysis tools for managing log volume growth
  - Daily manual log inspection for developer calibration
  - Traces as linked event sequences forming a complete transaction timeline
  - Trace content: query → actions → retrieved documents → final prompt → response, with timing and cost per step

### Drift Detection in AI Applications
- **summary**: Monitoring for degradation caused by system prompt changes, user behavior shifts, or undisclosed upstream model updates.
- **source**: Ch10 > AI Engineering Architecture > Monitoring and Observability > Drift detection
- **merged_from**:
  - Sources of change in complex AI applications
  - System prompt changes: template updates, coworker edits; simple logic sufficient to detect
  - User behavior changes: users adapting to technology over time causing gradual metric shifts
  - Underlying model changes: API-level model updates not always disclosed by providers

### AI Pipeline Orchestration
- **summary**: A coordination layer that defines components and chains them into an end-to-end pipeline, managing data flow and failure notification.
- **source**: Ch10 > AI Engineering Architecture > AI Pipeline Orchestration
- **merged_from**:
  - Orchestrator definition: specifies how components work together to create an end-to-end pipeline
  - Two high-level orchestrator operations: components definition and chaining
  - Components definition: registering models, data sources, tools, and evaluation/monitoring integrations
  - Chaining as function composition: specifying sequential steps from raw query to final response
  - Orchestrator responsibility: passing data between components and notifying on data flow failures
  - AI pipeline orchestrator vs. general workflow orchestrator — the distinction matters for choosing the right tool
  - Parallel execution guidance for latency-sensitive pipelines
  - Available orchestration tools: LangChain, LlamaIndex, Flowise, Langflow, Haystack
  - Advice to start without an orchestrator to avoid abstraction hiding critical system details
  - Three evaluation criteria for choosing an orchestrator: integration/extensibility, complex pipeline support, ease-of-use/performance/scalability

## User Feedback

### User Feedback Roles and Data Flywheel
- **summary**: User feedback serves dual roles — evaluating model performance and supplying training data — enabling a compounding data flywheel advantage.
- **source**: Ch10 > User Feedback
- **merged_from**:
  - User feedback's two key roles: evaluating performance and informing development
  - User feedback as proprietary data powering the data flywheel (Chapter 8)
  - First-mover advantage: early launch → user data → continuous model improvement → competitive moat
  - Privacy obligations: user data rights and transparency about data usage

### Explicit vs. Implicit User Feedback
- **summary**: Explicit signals (thumbs, ratings) are easy to interpret but sparse; implicit signals (inferred from behavior) are abundant but noisy.
- **source**: Ch10 > User Feedback > Extracting Conversational Feedback
- **merged_from**:
  - Explicit vs. implicit feedback: thumbs up/down, star ratings vs. inferred from user actions
  - Conversational interface making feedback easier to give but harder to extract
  - Explicit feedback easier to interpret but sparse and subject to response biases
  - Implicit feedback abundant but noisy; interpretation requires user study
  - Combining signals improves clarity: rephrase after link sharing suggests disappointment
  - Implicit conversational feedback extraction as a small but growing research area

### Natural Language Feedback Signals
- **summary**: Feedback embedded in conversation text, including early termination, error corrections, complaints, and sentiment expressions.
- **source**: Ch10 > User Feedback > Extracting Conversational Feedback > Natural language feedback
- **merged_from**:
  - Definition: feedback extracted from message content
  - Early termination as a signal of poor conversation quality: stopping generation, exiting, telling model to stop
  - "No, …" or "I meant, …" phrasing as indicators of off-target responses
  - Rephrase attempts as error correction signals detectable via heuristics or ML models
  - Specific correction feedback and action-correcting feedback in agentic use cases
  - Explicit confirmation requests: "Are you sure?", "Check again", "Show me the sources"
  - User edits to model output as strong failure signal and source of preference data
  - User edits as preference finetuning data: original = losing response, edited = winning response
  - General negative expressions without correction attempts
  - General negative sentiment (frustration, disappointment) as a conversation-quality proxy
  - Model refusal rate as an implicit negative feedback signal

### Conversational Behavioral Feedback Signals
- **summary**: Non-textual user actions within a conversation — regeneration, deletion, renaming, bookmarking, and conversation length — that signal satisfaction or dissatisfaction.
- **source**: Ch10 > User Feedback > Extracting Conversational Feedback > Other conversational feedback
- **merged_from**:
  - Regeneration as potential dissatisfaction signal vs. curiosity for options
  - Stronger regeneration signal with usage-based billing than subscriptions
  - Regeneration for consistency checking in complex requests
  - Comparative regeneration data as preference finetuning material
  - Delete, rename, share, bookmark actions as signals with varying strengths
  - Deletion as strong negative signal (unless privacy-motivated)
  - Turns per conversation interpreted differently by application type
  - Distinct token or topic count measuring dialogue diversity
  - Long conversation with repeated lines indicating a stuck loop

### Feedback Collection Timing and Triggers
- **summary**: Feedback should be collected throughout the user journey — at onboarding, on failures, and when the model has low confidence — without disrupting workflow.
- **source**: Ch10 > User Feedback > Feedback Design > When to collect feedback
- **merged_from**:
  - Feedback collection throughout the user journey; nonintrusive; should not disrupt workflow
  - Calibration feedback on sign-up: face ID scanning, voice recognition training, skill-level assessment
  - Failure notification mechanisms: downvote, regenerate, model switch options
  - Conversational failure feedback: "You're wrong", "Too cliche", "I want something shorter"
  - Letting users collaborate with AI (edit category) or with humans (customer support transfer)
  - Presenting two summary versions side by side when uncertain; comparative signal for preference finetuning
  - Managing feedback request frequency: show to 1% of users; risk of bias in small samples

### Feedback Collection UX Design
- **summary**: Feedback UI should be seamless, non-disruptive, and incentivized, with careful design to avoid ambiguity and noisy signals.
- **source**: Ch10 > User Feedback > Feedback Design > How to collect feedback
- **merged_from**:
  - Seamless feedback integration: easy to give, non-disruptive, easy to ignore, incentivized
  - GitHub Copilot Tab-to-accept / continue-typing-to-ignore as frictionless binary signal
  - Standalone AI apps vs. integrated products: ChatGPT doesn't know if generated email was sent; Gmail tracks draft usage
  - Thumbs up/down usefulness for product analytics; need for conversational context for deeper analysis
  - Consent and data donation flow for feedback-with-context collection
  - Transparency about how feedback is used as a motivator for higher quality contributions
  - Not asking users to do the impossible: avoid ambiguous comparative questions
  - UI clarity: icons, tooltips; risk of ambiguous design causing noisy feedback
  - Private vs. public signals: effect on user candor, discoverability, and explainability

### Feedback Biases
- **summary**: Systematic distortions in user feedback including leniency, randomness, position, and preference biases that must be understood and mitigated.
- **source**: Ch10 > User Feedback > Feedback Limitations > Biases
- **merged_from**:
  - Overview: each application has its own feedback biases; important to understand and design around them
  - Leniency bias: tendency to rate positively to avoid conflict or extra work
  - Leniency bias mitigation: replacing numeric scales with descriptive phrases to reduce strong negative connotation
  - Randomness: users providing random feedback from lack of motivation to engage deeply
  - Position bias: users more likely to click first suggestion regardless of quality; mitigation via random position variation or position-aware modeling
  - Preference bias: length bias in side-by-side comparisons; recency bias in sequential answer evaluation
  - Imperative to inspect feedback to uncover biases and interpret correctly

### Degenerate Feedback Loop
- **summary**: A self-reinforcing cycle where model predictions shape user feedback, which trains the next model iteration, amplifying initial biases and narrowing model behavior.
- **source**: Ch10 > User Feedback > Feedback Limitations > Degenerate feedback loop
- **merged_from**:
  - User feedback incompleteness: only feedback on what is shown
  - Degenerate feedback loop mechanism: predictions influence feedback, which influences next model iteration, amplifying initial biases
  - Video recommendation exposure bias example: slightly higher-ranked video gets more clicks
  - Cat photo amplification example illustrating how feedback loops narrow product focus
  - Risk of sycophancy: models trained on user feedback learn to tell users what they want to hear
  - Conclusion: understand feedback limitations and potential impact before incorporating it into product
