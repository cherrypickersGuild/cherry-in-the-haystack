# AI Engineering Ch. 9–10 — Express Outline
## Inference Fundamentals
### Inference Optimization Overview
### Training vs. Inference Lifecycle
### Inference Server and Service Architecture
### Computational Bottleneck Types
### Roofline Model
### Prefill and Decode Steps in Autoregressive Inference
### Online vs. Batch Inference APIs
### Streaming Mode
## Inference Performance Metrics
### Latency Metrics (TTFT and TPOT)
### Latency in Agentic Contexts
### Latency Distribution and Percentile Analysis
### Throughput Metrics
### Goodput
### GPU Utilization and nvidia-smi
### MFU (Model FLOP/s Utilization)
### MBU (Model Bandwidth Utilization)
## AI Accelerators
### AI Accelerator Landscape
### CPU vs. GPU Design Philosophy
### Inference vs. Training Chip Design
### Compute Primitives Across Hardware
### Accelerator Computational Capabilities (FLOP/s)
### GPU Memory Hierarchy
### Accelerator Power Consumption
### Accelerator Selection Criteria
## Model Optimization Techniques
### Foundation Model Resource Intensity
### Model Compression Overview
### Pruning
### Weight-Only Quantization
### Knowledge Distillation
### Autoregressive Decoding Bottleneck
### Speculative Decoding
### Inference with Reference
### Parallel Decoding
### KV Cache
### KV Cache Memory Bottleneck in Long-Context Serving
### Attention Mechanism Redesigns
### KV Cache Size Optimization Techniques
### FlashAttention and Kernel-Level Attention Optimization
### GPU Kernels and Kernel Optimization Techniques
### Model Compilation and Lowering
## Inference Service Optimization
### Inference Service Optimization Overview
### Static and Dynamic Batching
### Continuous Batching
### Prefill-Decode Disaggregation
### Prompt Caching
### Data Parallelism and Replica Parallelism
### Model Parallelism
### Context and Sequence Parallelism
## AI Engineering Application Architecture
### Gradual AI Application Architecture
### Context Enhancement and Retrieval
### Input Guardrails
### Output Guardrails
### Guardrail Implementation Trade-offs
### Model Router
### Model Gateway
### Exact Caching
### Semantic Caching
### Agentic Patterns in Application Architecture
### AI Pipeline Monitoring and Observability
### AI Application Metrics Design
### Logging and Tracing for AI Pipelines
### Drift Detection in AI Applications
### AI Pipeline Orchestration
## User Feedback
### User Feedback Roles and Data Flywheel
### Explicit vs. Implicit User Feedback
### Natural Language Feedback Signals
### Conversational Behavioral Feedback Signals
### Feedback Collection Timing and Triggers
### Feedback Collection UX Design
### Feedback Biases
### Degenerate Feedback Loop
