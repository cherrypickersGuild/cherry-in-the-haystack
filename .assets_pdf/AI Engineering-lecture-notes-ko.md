# AI Engineering Ch. 9–10 — Express Outline

## Inference Fundamentals

### Inference Optimization Overview
추론 최적화(inference optimization)는 모델, 하드웨어, 서비스 세 가지 수준에서 수행되며, 모델을 더 빠르고 저렴하게 만드는 것을 목표로 한다. AI 엔지니어는 모델이 아무리 뛰어나도 속도가 느리거나 비용이 너무 높으면 실제 서비스에서 가치를 잃는다는 사실을 이해해야 한다.

### Training vs. Inference Lifecycle
AI 모델의 수명 주기에는 모델을 구축하는 훈련(training)과 입력에 대한 출력을 계산하는 추론(inference)이라는 두 가지 단계가 있다. 훈련은 순전파(forward pass)와 역전파(backward pass)를 모두 포함하지만, 추론은 순전파만 포함하므로, 모델을 직접 훈련하거나 파인튜닝하지 않는다면 추론에 집중해야 한다.

### Inference Server and Service Architecture
추론 서버(inference server)는 모델을 호스팅하고 필요한 하드웨어에 접근하여 사용자 요청을 처리한 뒤 응답을 반환하는 컴포넌트이며, 더 넓은 추론 서비스(inference service)의 일부로 요청 수신, 라우팅, 전처리도 담당한다. AI 엔지니어가 모델을 직접 호스팅한다면 이 추론 서비스의 구축과 유지관리를 직접 책임지게 된다.

### Computational Bottleneck Types
추론 워크로드의 두 가지 주요 병목은 연산량에 의해 제한되는 compute-bound와 메모리와 프로세서 간 데이터 전송 속도에 의해 제한되는 memory bandwidth-bound이다. 어떤 병목이 존재하는지를 파악해야 compute-bound에는 더 강력한 칩을, bandwidth-bound에는 더 높은 대역폭을 갖춘 칩을 선택하는 등 올바른 최적화 전략을 적용할 수 있다.

### Roofline Model
Roofline 모델은 연산의 산술 집약도(arithmetic intensity)를 기반으로 워크로드가 compute-bound인지 memory bandwidth-bound인지를 시각적으로 판별하는 도구이며, NVIDIA Nsight 같은 프로파일링 툴이 이 차트를 제공한다. AI 엔지니어는 이 차트를 통해 시스템의 병목 지점을 진단하고 적절한 최적화 방향을 결정할 수 있다.

### Prefill and Decode Steps in Autoregressive Inference
트랜스포머 기반 언어 모델의 추론은 입력 토큰을 병렬로 처리하는 prefill 단계(compute-bound)와 출력 토큰을 한 번에 하나씩 생성하는 decode 단계(memory bandwidth-bound)로 구성된다. 두 단계가 서로 다른 연산 특성을 가지기 때문에, 프로덕션 환경에서는 이 두 단계를 별도의 머신에서 실행하는 분리 전략이 사용된다.

### Online vs. Batch Inference APIs
온라인 API는 레이턴시 최소화에 최적화되어 요청이 들어오는 즉시 처리하며, 배치 API는 비용 절감을 위해 요청을 묶어 처리하고 수 시간의 처리 시간을 허용한다. 챗봇이나 코드 생성처럼 실시간 응답이 필요한 서비스에는 온라인 API가, 합성 데이터 생성이나 정기 보고서 처리처럼 엄격한 레이턴시 요구가 없는 작업에는 배치 API가 적합하다.

### Streaming Mode
스트리밍 모드는 모델이 각 토큰을 생성하는 즉시 반환하여 사용자가 첫 번째 토큰을 기다리는 시간을 줄이는 방식이다. 그러나 응답이 완성되기 전에 사용자에게 표시되기 때문에, 부적절한 응답이 먼저 노출될 위험이 있어 사후 수정 정책이 필요하다.

## Inference Performance Metrics

### Latency Metrics (TTFT and TPOT)
TTFT(Time to First Token)는 사용자가 쿼리를 보낸 후 첫 번째 토큰이 생성될 때까지의 시간으로 prefill 단계의 길이에 의해 결정되며, TPOT(Time per Output Token)는 첫 번째 토큰 이후 각 출력 토큰을 생성하는 데 걸리는 시간이다. 전체 레이턴시는 TTFT + TPOT × (출력 토큰 수)로 계산되며, AI 엔지니어는 애플리케이션의 사용자 경험 목표에 따라 두 지표 간의 균형을 조율해야 한다.

### Latency in Agentic Contexts
CoT(chain-of-thought)나 에이전틱 쿼리처럼 모델이 중간 단계를 생성하지만 사용자에게는 보여주지 않는 경우, 모델 관점의 TTFT와 사용자가 실제로 인식하는 TTFT는 크게 달라질 수 있다. 일부 팀은 이를 명확히 구분하기 위해 사용자가 실제로 처음 보는 토큰까지의 시간을 "time to publish"라는 별도 지표로 측정한다.

### Latency Distribution and Percentile Analysis
레이턴시는 분포이기 때문에 평균값은 이상치(outlier)로 인해 왜곡될 수 있으며, p50, p90, p95, p99 등의 백분위수(percentile)로 분석하는 것이 더 유용하다. 백분위수 분석을 통해 일부 요청에서 발생하는 비정상적인 레이턴시를 발견하고 시스템 문제의 징후를 조기에 탐지할 수 있다.

### Throughput Metrics
처리량(throughput)은 추론 서비스가 모든 사용자 및 요청에 걸쳐 초당 생성하는 출력 토큰 수를 의미하며, tokens/s(TPS) 또는 requests per minute(RPM)으로 측정된다. 처리량은 컴퓨팅 비용과 직접 연결되어 있어, 처리량이 높을수록 요청당 비용이 낮아지므로 서비스 효율성을 평가하는 핵심 지표이다.

### Goodput
Goodput은 SLO(Software-Level Objective)를 충족하는 초당 요청 수를 측정하는 지표로, 단순 처리량과 달리 레이턴시 요구 조건을 통과한 요청만을 카운트한다. 처리량과 비용에만 집중하면 사용자 경험이 나빠질 수 있기 때문에, goodput은 레이턴시와 처리량의 균형을 동시에 평가할 수 있는 실용적인 지표이다.

### GPU Utilization and nvidia-smi
nvidia-smi의 GPU 사용률 지표는 GPU가 작업을 능동적으로 처리한 시간의 비율을 나타내지만, 실제로 그 처리가 얼마나 효율적인지는 알려주지 않는다. 따라서 GPU가 100% 사용률을 보고하더라도 연산이 비효율적으로 이루어지고 있을 수 있으며, AI 엔지니어는 이 지표만으로 성능을 판단해서는 안 된다.

### MFU (Model FLOP/s Utilization)
MFU(Model FLOP/s Utilization)는 실제 관측된 처리량(tokens/s)이 시스템의 이론적 최대 처리량 대비 몇 퍼센트인지를 나타내는 지표로, PaLM 논문에서 처음 도입되었다. 훈련 시 MFU는 보통 추론보다 높으며, 50% 이상이면 양호한 수준으로 간주되지만 하드웨어에 따라 달성하기 어려울 수 있다.

### MBU (Model Bandwidth Utilization)
MBU(Model Bandwidth Utilization)는 추론 과정에서 하드웨어의 이론적 최대 메모리 대역폭 중 실제로 사용된 비율을 측정하며, `(파라미터 수 × bytes/param × tokens/s) / 이론적 대역폭`으로 계산된다. 메모리 대역폭이 비용이 많이 드는 자원이기 때문에, MBU를 추적함으로써 양자화(quantization) 등의 최적화가 대역폭 활용에 미치는 효과를 확인할 수 있다.

## AI Accelerators

### AI Accelerator Landscape
AI 가속기는 AI 워크로드를 가속하기 위해 설계된 칩이며, 현재는 NVIDIA GPU가 지배적이지만 AMD GPU, Google TPU, Intel Habana Gaudi, Groq LPU, Cerebras QPU 등 다양한 대안이 등장하고 있다. AI 엔지니어는 자신의 워크로드 특성에 맞는 가속기를 선택하기 위해 이 생태계의 다양성을 이해해야 한다.

### CPU vs. GPU Design Philosophy
CPU는 소수의 강력한 코어로 순차적 범용 작업에 최적화된 반면, GPU는 수천 개의 소형 코어로 행렬 곱셈처럼 고도로 병렬화 가능한 작업에 최적화되어 있다. ML 워크로드의 90% 이상이 행렬 곱셈으로 구성되어 있기 때문에 GPU가 AI 훈련 및 추론에 적합하다.

### Inference vs. Training Chip Design
훈련용 칩은 역전파로 인해 더 많은 메모리와 높은 정밀도가 필요하고 처리량을 중시하는 반면, 추론 전용 칩은 낮은 정밀도와 빠른 메모리 접근에 최적화되어 레이턴시 최소화를 목표로 한다. Apple Neural Engine, AWS Inferentia, Meta MTIA 등 추론 전용 칩이 늘어나는 것은, 추론 비용이 훈련 비용을 넘어설 수 있다는 현실을 반영한다.

### Compute Primitives Across Hardware
다양한 하드웨어 아키텍처는 스칼라, 벡터, 텐서 등 서로 다른 데이터 유형에 최적화된 연산 단위(compute primitive)를 갖추고 있으며, 예를 들어 GPU는 벡터 연산에서 시작해 현재는 텐서 코어를 포함하고, TPU는 텐서 연산을 기본 연산으로 설계되었다. 모델을 특정 하드웨어에서 효율적으로 실행하려면 해당 하드웨어의 메모리 레이아웃과 연산 단위를 고려해야 한다.

### Accelerator Computational Capabilities (FLOP/s)
가속기의 연산 능력은 초당 부동소수점 연산 횟수인 FLOP/s로 측정되며, 수치 정밀도가 높을수록 단위 시간당 수행 가능한 연산 수가 줄어든다. 예를 들어 NVIDIA H100 SXM은 FP8 텐서 코어 기준으로 3,958 teraFLOP/s를 제공하며, 낮은 정밀도 포맷을 활용할수록 더 높은 연산 처리 능력을 확보할 수 있다.

### GPU Memory Hierarchy
GPU 가속기는 CPU DRAM(낮은 대역폭, 큰 용량), GPU HBM(고대역폭, 수십 GB 수준), GPU 온칩 SRAM(매우 높은 대역폭, 수십 MB 수준)의 세 가지 메모리 계층으로 구성된다. 많은 GPU 최적화는 이 메모리 계층을 최대한 활용하는 방법에 집중되어 있으며, CUDA, Triton, ROCm 같은 GPU 프로그래밍 언어를 통해 세밀한 메모리 접근 제어가 가능하다.

### Accelerator Power Consumption
GPU는 수십억 개의 트랜지스터를 사용하여 연산을 수행하며, NVIDIA H100은 80억 개의 트랜지스터를 갖고 풀로드 시 연간 약 7,000 kWh를 소비한다. 전력 소비는 가속기 선택 시 중요한 고려 요소이며, 데이터센터의 전력 가용성이 대규모 AI 인프라 확장의 핵심 병목 중 하나이다.

### Accelerator Selection Criteria
가속기 선택의 핵심 질문은 세 가지로, 해당 하드웨어가 워크로드를 실행할 수 있는지, 얼마나 빠르게 처리하는지, 비용은 얼마인지이다. Compute-bound 워크로드에는 FLOP/s가 높은 칩을, memory-bound 워크로드에는 대역폭과 메모리 용량이 큰 칩을 선택하는 것이 기본 원칙이다.

## Model Optimization Techniques

### Foundation Model Resource Intensity
파운데이션 모델의 추론이 자원 집약적인 이유는 모델 크기, 자기회귀적 디코딩(autoregressive decoding), 어텐션 메커니즘이라는 세 가지 특성 때문이다. 이 세 가지 특성 각각에 대한 최적화 기법을 이해하는 것이 효율적인 추론 시스템을 설계하는 출발점이다.

### Model Compression Overview
모델 압축(model compression)은 모델의 크기를 줄여 더 빠르고 저렴하게 만드는 기법들의 총칭으로, 양자화(quantization), 증류(distillation), 가지치기(pruning)가 대표적이다. 크기를 줄이면 추론 속도와 메모리 효율성이 함께 개선되지만, 일부 기법은 모델의 품질을 저하시킬 수 있다.

### Pruning
가지치기(pruning)는 신경망에서 예측에 가장 덜 유용한 파라미터를 제거하거나 0으로 설정하여 모델을 희소하게 만드는 기법으로, 저장 공간 절감과 연산 속도 향상을 가져온다. 그러나 원본 아키텍처에 대한 깊은 이해가 필요하고, 모든 하드웨어가 결과적인 희소성을 활용하도록 최적화되어 있지 않아 실제 적용은 상대적으로 적은 편이다.

### Weight-Only Quantization
가중치 전용 양자화(weight-only quantization)는 모델의 가중치 정밀도를 낮추어 메모리 사용량을 줄이고 처리량을 높이는 기법으로, 32비트에서 16비트로 낮추면 메모리 사용량이 절반으로 줄어든다. 구현이 쉽고 대부분의 모델에서 즉시 효과를 발휘하기 때문에 현재 가장 널리 사용되는 모델 압축 기법이다.

### Knowledge Distillation
지식 증류(knowledge distillation)는 큰 모델(teacher)의 동작을 모방하도록 작은 모델(student)을 훈련시켜, 훨씬 적은 파라미터로 유사한 성능을 달성하는 기법이다. 큰 모델이 가진 행동을 더 적은 파라미터로 포착할 수 있다는 개념에 기반하며, 가지치기와 함께 모델 경량화의 주요 접근법 중 하나이다.

### Autoregressive Decoding Bottleneck
자기회귀 언어 모델은 토큰을 하나씩 순차적으로 생성하는데, 각 토큰 생성 시마다 모델 가중치 전체를 가속기 메모리에서 연산 유닛으로 전송해야 하므로 대역폭 집약적이고 느리다. 출력 토큰 하나의 레이턴시 영향이 입력 토큰 약 100개와 맞먹을 정도로 크기 때문에, 이 병목을 극복하는 것이 추론 최적화의 핵심 과제 중 하나이다.

### Speculative Decoding
투기적 디코딩(speculative decoding)은 작고 빠른 초안 모델(draft model)이 K개의 토큰을 먼저 생성하면, 대상 모델(target model)이 이를 병렬로 검증하고 허용 가능한 최장 부분 수열을 채택하는 방식으로 출력 속도를 높인다. 검증이 순차 생성보다 빠르고(병렬화 가능), 디코딩이 memory bandwidth-bound이므로 유휴 FLOP으로 검증을 수행할 수 있어 모델 품질 변화 없이 레이턴시를 크게 줄일 수 있다.

### Inference with Reference
참조 기반 추론(inference with reference)은 입력에서 출력으로 반복될 가능성이 높은 토큰 구간을 직접 복사하여 생성 속도를 높이는 기법으로, 별도의 초안 모델 없이 동작한다. 검색 결과 요약, 코드 수정, 멀티턴 대화처럼 입력과 출력 사이에 큰 텍스트 중복이 있는 시나리오에서 약 2배의 속도 향상을 달성할 수 있다.

### Parallel Decoding
병렬 디코딩(parallel decoding)은 자기회귀적 순차 생성의 의존성을 깨고 여러 토큰을 동시에 생성하려는 기법으로, Lookahead decoding과 Medusa 등이 대표적 구현이다. 병렬로 생성된 토큰은 상호 일관성 검증 단계를 거쳐야 하므로 구현이 복잡하지만, Medusa의 경우 Llama 3.1에서 최대 1.9배의 토큰 생성 속도 향상을 보였다.

### KV Cache
KV 캐시(KV cache)는 이전 토큰들의 키(key)와 값(value) 벡터를 저장해두어 다음 토큰 생성 시 재계산하지 않아도 되게 하는 추론 전용 캐시이다. KV 캐시가 없으면 토큰을 생성할 때마다 이전 모든 토큰에 대한 벡터를 재계산해야 하므로, 이를 통해 추론 속도를 대폭 향상시킬 수 있다.

### KV Cache Memory Bottleneck in Long-Context Serving
KV 캐시의 크기는 배치 크기와 시퀀스 길이에 따라 선형적으로 증가하며, 500B+ 모델에서 배치 크기 512, 컨텍스트 길이 2048 기준으로 약 3TB에 달할 수 있어 가용 메모리를 초과하는 병목이 된다. 특히 긴 컨텍스트를 다루는 애플리케이션에서는 KV 캐시 크기 관리가 추론 처리량의 핵심 제약 요소가 된다.

### Attention Mechanism Redesigns
어텐션 메커니즘을 재설계하여 KV 캐시 크기와 연산량을 줄이는 기법으로, local windowed attention(근처 토큰만 어텐션), multi-query attention(쿼리 헤드 간 KV 공유), grouped-query attention(쿼리 헤드를 그룹화하여 KV 공유), cross-layer attention(인접 레이어 간 KV 공유) 등이 있다. 이러한 설계 변경은 훈련 또는 파인튜닝 시에만 적용 가능하지만, Character.AI의 사례처럼 KV 캐시를 20배 이상 줄여 메모리 병목을 해소하는 데 효과적이다.

### KV Cache Size Optimization Techniques
KV 캐시의 메모리 관리를 최적화하는 방법으로는 vLLM이 도입한 PagedAttention(KV 캐시를 비연속 블록으로 나누어 단편화 감소 및 유연한 메모리 공유 지원), KV 캐시 양자화, 적응형 KV 캐시 압축, 선택적 KV 캐시 등이 있다. 이러한 기법들은 특히 긴 컨텍스트 서빙 시 메모리 병목을 완화하고 더 큰 배치 크기를 허용하여 처리량을 높이는 데 기여한다.

### FlashAttention and Kernel-Level Attention Optimization
FlashAttention은 트랜스포머 모델에서 공통적으로 사용되는 여러 연산을 하나의 커널로 융합(fuse)하여 실행 효율을 높이는 어텐션 연산 전용 커널이다. 이 접근법은 어텐션 메커니즘 자체나 KV 캐시 저장 방식을 변경하지 않고 연산이 실행되는 방식을 개선하며, FlashAttention-3처럼 새로운 하드웨어 아키텍처에 맞춰 지속적으로 업데이트된다.

### GPU Kernels and Kernel Optimization Techniques
커널(kernel)은 GPU, TPU 등 특정 하드웨어 가속기에 최적화된 코드 조각으로, 벡터화(vectorization), 병렬화(parallelization), 루프 타일링(loop tiling), 연산자 융합(operator fusion) 등의 기법을 사용하여 작성된다. 커널 작성은 CUDA, Triton, ROCm 같은 저수준 언어와 하드웨어 메모리 계층에 대한 깊은 이해를 요구하는 전문 분야로, 추론 최적화에서 중요한 성능 향상 수단이다.

### Model Compilation and Lowering
모델 스크립트를 특정 하드웨어에서 실행 가능한 언어로 변환하는 과정을 로워링(lowering)이라 하며, 이를 수행하는 도구를 컴파일러(compiler)라 한다. torch.compile, XLA, TensorRT 등의 컴파일러는 로워링 과정에서 가능한 경우 연산을 전용 커널로 변환하여 실행 속도를 높이며, AI 엔지니어는 이를 통해 비교적 적은 노력으로 상당한 처리량 향상을 얻을 수 있다.

## Inference Service Optimization

### Inference Service Optimization Overview
서비스 수준 최적화는 고정된 자원(컴퓨팅 및 메모리)과 동적인 워크로드를 가진 상황에서 레이턴시와 비용을 최적화하기 위해 자원을 효율적으로 배분하는 것을 목표로 한다. 모델 수준 최적화와 달리, 서비스 수준 기법은 모델 자체를 수정하지 않으므로 출력 품질에 영향을 주지 않는다.

### Static and Dynamic Batching
정적 배칭(static batching)은 배치가 가득 찰 때까지 요청을 기다리는 방식으로 첫 번째 요청에 불필요한 지연이 발생하고, 동적 배칭(dynamic batching)은 최대 시간 창(time window)을 설정하여 배치가 차거나 시간이 만료되면 처리하여 레이턴시를 관리한다. 두 방법 모두 LLM처럼 요청마다 응답 길이가 크게 다른 경우, 긴 응답이 완료될 때까지 짧은 응답도 기다려야 하는 비효율이 있다.

### Continuous Batching
연속 배칭(continuous batching, 또는 in-flight batching)은 배치 내 응답이 완료되는 즉시 사용자에게 반환하고, 그 자리에 새 요청을 추가하여 배칭을 연속적으로 유지하는 방식이다. 이를 통해 짧은 응답이 긴 응답 완료를 기다리는 불필요한 레이턴시를 없애고, 전체 시스템의 처리량과 자원 활용도를 크게 높일 수 있다.

### Prefill-Decode Disaggregation
prefill과 decode를 별도의 인스턴스(예: 다른 GPU)에 할당하는 분리 기법(disaggregation)은 두 단계가 서로 다른 연산 특성을 가지기 때문에 동일 머신에서 경쟁하는 비효율을 해소한다. DistServe, Inference Without Interference 등의 연구에 따르면 이 분리는 레이턴시 요구사항을 유지하면서 처리 가능한 요청 수를 크게 늘리며, prefill 대 decode 인스턴스 비율은 워크로드 특성과 TTFT/TPOT 우선순위에 따라 조정한다.

### Prompt Caching
프롬프트 캐싱(prompt caching)은 여러 요청에서 반복되는 텍스트 세그먼트(주로 시스템 프롬프트나 공통 문서)를 캐시에 저장하여 처음 한 번만 처리하고 이후 요청에서 재사용하는 기법이다. 시스템 프롬프트가 길거나 동일 문서에 대한 쿼리가 많은 애플리케이션에서 레이턴시와 비용을 크게 줄일 수 있으며, Anthropic은 최대 90% 비용 절감과 75% 레이턴시 감소를 보고하였다.

### Data Parallelism and Replica Parallelism
레플리카 병렬성(replica parallelism)은 모델의 복사본을 여러 개 생성하여 더 많은 동시 요청을 처리할 수 있게 하는 가장 단순한 병렬화 전략으로, 훈련에서의 데이터 병렬성에 해당한다. 더 많은 레플리카는 더 많은 칩 사용을 의미하지만 각 머신이 처리하는 요청 수가 줄어들어 응답 시간이 개선되며, 레이턴시 우선순위가 높을 때 효과적인 선택이다.

### Model Parallelism
모델 병렬성(model parallelism)은 단일 머신에 맞지 않는 대형 모델을 여러 머신에 나누어 배치하는 기법으로, 추론에서는 텐서를 분할하여 여러 장치에서 병렬 실행하는 텐서 병렬성(tensor parallelism)이 가장 일반적이다. 텐서 병렬성은 단일 머신에 올라가지 않는 모델을 서빙할 수 있게 하고 레이턴시를 줄이며, 파이프라인 병렬성(pipeline parallelism)은 처리량 향상에 유리하지만 레이턴시 증가로 인해 엄격한 레이턴시 요구 환경에서는 기피된다.

### Context and Sequence Parallelism
컨텍스트 병렬성(context parallelism)은 긴 입력 시퀀스를 여러 장치에 나누어 각각 처리하고, 시퀀스 병렬성(sequence parallelism)은 전체 입력에 필요한 연산자들을 여러 머신에 분산하여 처리하는 기법이다. 이 두 기법은 비교적 덜 일반화되어 있지만, 점점 길어지는 컨텍스트를 효율적으로 처리하기 위한 다양한 병렬화 전략의 가능성을 보여준다.

## AI Engineering Application Architecture

### Gradual AI Application Architecture
AI 애플리케이션 아키텍처는 가장 단순한 형태(쿼리 → 모델 → 응답)에서 시작하여, 컨텍스트 강화 → 가드레일 → 라우터/게이트웨이 → 캐싱 → 에이전트 패턴의 순서로 점진적으로 구성 요소를 추가하는 방식이 권장된다. 각 추가 구성 요소는 시스템의 기능, 안전성, 또는 속도를 향상시키지만 동시에 복잡성과 새로운 장애 모드를 도입하므로, 필요에 따라 단계적으로 도입하는 것이 중요하다.

### Context Enhancement and Retrieval
컨텍스트 강화(context enhancement)는 모델이 각 쿼리에 답하는 데 필요한 관련 정보를 외부 데이터 소스, 도구(웹 검색, 뉴스 API 등), 파일 업로드 등을 통해 구성하는 과정이다. 파운데이션 모델을 위한 피처 엔지니어링에 해당하는 이 과정은 시스템 출력 품질에 핵심적 역할을 하며, 거의 모든 모델 API 제공업체가 이를 지원하지만 각 제공업체의 지원 범위와 방식은 다를 수 있다.

### Input Guardrails
입력 가드레일(input guardrails)은 외부 API로 민감 정보가 유출되는 위험과 시스템을 손상시킬 수 있는 악의적 프롬프트 실행을 방어하는 역할을 한다. 민감 정보 감지 도구를 사용하여 개인정보, 회사 기밀 등을 마스킹하거나 쿼리를 차단하는 방식으로 구현하며, 역매핑(reverse PII map)을 통해 생성된 응답에서 원래 정보를 복원할 수 있다.

### Output Guardrails
출력 가드레일(output guardrails)은 품질 실패(잘못된 형식, 환각, 불량 응답)와 보안 실패(독성 콘텐츠, 민감 정보 노출, 원격 코드 실행 유발)를 탐지하고, 재시도(retry), 병렬 호출, 인간 운영자로 이관하는 등의 처리 정책을 명시하는 구성 요소이다. 출력 가드레일은 보안과 품질을 높이지만, 스트리밍 모드에서는 부분 응답을 평가하기 어렵고 추가 레이턴시와 비용이 발생하는 트레이드오프를 수반한다.

### Guardrail Implementation Trade-offs
가드레일은 신뢰성 vs. 레이턴시, 안전성 vs. 유연성이라는 근본적인 트레이드오프를 동반하며, 일부 팀은 레이턴시가 더 중요하다는 판단 하에 가드레일 구현을 최소화하기도 한다. 타사 API를 사용할 경우 API 제공업체가 기본 가드레일을 제공하지만, 자체 호스팅 시에는 더 많은 가드레일을 직접 구현해야 하며, Meta Purple Llama, NVIDIA NeMo Guardrails, Azure AI content filters 등 기성 솔루션을 활용할 수 있다.

### Model Router
모델 라우터(model router)는 사용자 의도를 분류하는 인텐트 분류기(intent classifier)를 기반으로 각 쿼리를 가장 적합한 모델이나 솔루션으로 연결하는 구성 요소이다. 라우팅을 통해 특화 모델 활용으로 정확도를 높이고, 간단한 쿼리를 저렴한 모델로 보내 비용을 절감할 수 있으며, 빠르고 저렴하게 동작해야 한다.

### Model Gateway
모델 게이트웨이(model gateway)는 다양한 모델(자체 호스팅 및 상업용 API)을 통합된 인터페이스로 접근할 수 있게 해주는 중간 계층으로, API 변경 시 게이트웨이만 수정하면 되어 유지보수 비용을 낮춘다. 또한 접근 제어, 비용 모니터링, 속도 제한 관리, 폴백 정책, 로드 밸런싱, 로깅 등 다양한 부가 기능을 중앙에서 관리할 수 있어 보안과 운영 효율성을 높인다.

### Exact Caching
정확 캐싱(exact caching)은 동일한 쿼리나 데이터가 요청될 때 이전에 계산된 결과를 그대로 반환하여 중복 연산을 방지하는 기법으로, 벡터 검색 결과나 긴 문서 요약처럼 계산 비용이 높은 작업에 특히 유용하다. LRU, LFU, FIFO 등의 캐시 축출 정책과 쿼리 유형별 캐싱 여부 분류기가 필요하며, 잘못 구현되면 사용자 간 데이터 누출 위험이 있다.

### Semantic Caching
의미론적 캐싱(semantic caching)은 정확히 일치하지 않더라도 의미적으로 유사한 쿼리에 대해 캐시된 응답을 재사용하는 기법으로, 캐시 히트율을 높여 비용을 줄일 수 있다. 그러나 고품질 임베딩, 적절한 유사도 임계값 설정, 신뢰할 수 있는 벡터 검색이 모두 필요하고, 구성 요소 중 하나라도 실패하면 잘못된 응답이 반환될 수 있어 도입 전 효율성, 비용, 성능 위험을 신중히 평가해야 한다.

### Agentic Patterns in Application Architecture
에이전트 패턴은 단순한 순차적 쿼리 흐름에서 벗어나 루프, 병렬 실행, 조건 분기를 포함하는 복잡한 애플리케이션 흐름을 가능하게 한다. 모델의 출력이 이메일 발송, 주문 실행, 계좌 이체 같은 쓰기 액션(write action)으로 연결될 경우 시스템의 역량이 크게 확장되지만, 그만큼 위험 노출도 증가하므로 각별한 주의가 필요하다.

### AI Pipeline Monitoring and Observability
모니터링(monitoring)은 시스템 정보를 추적하는 행위이고, 관찰 가능성(observability)은 외부 출력과 로그만으로 시스템 내부 상태를 추론할 수 있도록 시스템을 설계하고 계측하는 전체 프로세스이다. 관찰 가능성은 제품 설계의 후처리가 아닌 내재적 요소로 다루어야 하며, MTTD(평균 감지 시간), MTTR(평균 응답 시간), CFR(변경 실패율)을 통해 관찰 가능성의 품질을 평가한다.

### AI Application Metrics Design
지표(metrics) 설계는 탐지하고자 하는 실패 모드를 먼저 이해하고 그에 맞는 측정 방법을 개발하는 방식으로 이루어져야 하며, 형식 실패, 환각, 독성, 비용 관련 지표 등 애플리케이션 특성에 맞게 다양하게 구성된다. 개별 지표는 사용자, 릴리스, 프롬프트 버전, 쿼리 유형, 시간 축으로 세분화하여 분석해야 하며, 비즈니스 북극성 지표(DAU, 세션 시간 등)와의 상관관계를 측정하는 것도 중요하다.

### Logging and Tracing for AI Pipelines
로그(log)는 시스템에서 발생한 이벤트의 추가 전용 기록으로, 설정, 사용자 쿼리, 최종 프롬프트, 출력, 중간 결과, 도구 호출 등 가능한 모든 것을 로깅해야 한다. 트레이스(trace)는 관련 이벤트들을 연결하여 요청이 시스템을 통과하는 전체 경로를 재구성한 것으로, 각 단계의 소요 시간과 비용을 포함하여 어느 단계에서 실패가 발생했는지 정확히 추적할 수 있게 한다.

### Drift Detection in AI Applications
AI 애플리케이션에서는 시스템 프롬프트 변경, 사용자 행동 변화, API를 통해 접근하는 기반 모델의 업데이트 등 다양한 요인으로 시스템 동작이 예고 없이 변할 수 있다. 드리프트를 감지하지 못하면 품질 저하가 장기간 발견되지 않을 수 있으므로, 이러한 변화를 탐지하기 위한 자동화된 모니터링과 조사 프로세스가 필수적이다.

### AI Pipeline Orchestration
AI 파이프라인 오케스트레이터는 모델, 외부 데이터 소스, 도구 등 다양한 구성 요소를 정의하고 이들이 엔드투엔드 파이프라인에서 어떻게 연동되는지를 명시하는 도구로, LangChain, LlamaIndex, Haystack 등이 대표적이다. 오케스트레이터는 구성 요소 간 데이터 흐름을 관리하고 오류를 처리하지만, 초기에는 오케스트레이터 없이 개발하는 것이 시스템의 내부 동작을 더 잘 이해하는 데 도움이 될 수 있다.

## User Feedback

### User Feedback Roles and Data Flywheel
사용자 피드백은 애플리케이션 성능 평가와 개발 방향 설정이라는 두 가지 전통적 역할 외에도, AI 애플리케이션에서는 미래 모델 훈련을 위한 독점적 데이터 소스로서 핵심적인 경쟁 우위가 된다. 빠르게 출시하여 사용자 데이터를 먼저 수집한 제품은 데이터 플라이휠(data flywheel)을 통해 모델을 지속적으로 개선하며 경쟁자가 따라잡기 어려운 우위를 만든다.

### Explicit vs. Implicit User Feedback
명시적 피드백(explicit feedback)은 좋아요/싫어요, 별점, 예/아니오 같은 직접적 요청에 응한 사용자 응답으로 해석이 쉽지만 수가 적고 응답 편향이 있다. 암묵적 피드백(implicit feedback)은 사용자 행동에서 추론되며 더 풍부하지만, 동일한 행동이 긍정 또는 부정 신호로 해석될 수 있어 노이즈가 크므로 신중한 해석이 필요하다.

### Natural Language Feedback Signals
자연어 피드백(natural language feedback)은 사용자 메시지의 내용에서 추출되는 피드백으로, 조기 종료(early termination), 오류 수정 시도("No, I meant…"), 불만 표현, 부정적 감정 등이 대표적 신호이다. 이러한 신호들을 프로덕션에서 추적함으로써 모델이 사용자를 어떻게 실패시키는지를 이해하고 프롬프트 개선이나 모델 수정의 방향을 도출할 수 있다.

### Conversational Behavioral Feedback Signals
대화 행동에서 추출되는 피드백 신호로는 응답 재생성(regeneration), 대화 삭제/이름 변경/공유 등의 대화 정리 행동, 대화 길이, 대화 다양성(토큰이나 토픽의 다양성) 등이 있다. 각 신호의 의미는 애플리케이션의 성격에 따라 달라지는데, 예를 들어 AI 동반자 앱에서 긴 대화는 긍정 신호이지만 고객 지원 챗봇에서는 부정 신호일 수 있다.

### Feedback Collection Timing and Triggers
피드백 수집은 사용자 온보딩 초기(앱 설정 및 선호도 파악), 오류 발생 시(환각, 부적절한 차단, 과도한 레이턴시), 모델 확신도가 낮을 때(두 응답의 비교 선택 요청) 등 사용자 여정 전반에 걸쳐 이루어져야 한다. 피드백 수집 시점은 사용자 워크플로를 방해하지 않도록 비침습적으로 설계해야 하며, 수집된 피드백은 선호도 파인튜닝을 위한 (쿼리, 채택 응답, 기각 응답) 데이터로 활용할 수 있다.

### Feedback Collection UX Design
피드백 수집 UX는 사용자 워크플로에 자연스럽게 통합되어 추가 작업 없이 피드백을 제공할 수 있게 설계해야 하며, Midjourney의 이미지 선택 워크플로와 GitHub Copilot의 Tab 수락/무시 방식이 대표적인 좋은 사례이다. 피드백 UI의 모호함(예: 아이콘 순서 혼동)은 노이즈가 많은 피드백을 만들어내므로, 명확한 아이콘, 툴팁, 옵션 문구를 사용하고 사용자가 이해하기 어려운 비교 과제는 피해야 한다.

### Feedback Biases
사용자 피드백에는 긍정 방향으로 과도하게 평가하는 관대함 편향(leniency bias), 무작위 응답(randomness), 첫 번째 옵션을 선호하는 위치 편향(position bias), 길이나 최근 순서를 기반으로 판단하는 선호 편향(preference bias) 등 다양한 편향이 내재한다. AI 엔지니어는 피드백 분포를 분석하여 이러한 편향을 이해하고, 편향의 영향을 최소화하도록 피드백 시스템을 설계하며, 피드백 해석 시 오류를 방지해야 한다.

### Degenerate Feedback Loop
피드백이 모델 행동을 수정하는 데 사용되고, 수정된 모델이 다시 피드백에 영향을 미치는 순환 구조에서는 초기 편향이 점점 증폭되는 변질 피드백 루프(degenerate feedback loop)가 발생할 수 있다. 이는 인기 콘텐츠가 더욱 인기 있어지는 노출 편향뿐 아니라, 연구에 따르면 사용자 피드백으로 훈련된 모델이 정확성보다 사용자가 듣고 싶은 말을 우선하는 아첨(sycophancy) 경향을 보일 수 있으므로, 피드백을 맹목적으로 적용하기 전에 그 한계와 잠재적 영향을 충분히 이해해야 한다.
