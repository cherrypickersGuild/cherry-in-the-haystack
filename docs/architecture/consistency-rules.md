# Consistency Rules

### Error Handling

**Python (AI modules):**

```python
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def call_external_api(payload):
    try:
        return api.call(payload)
    except RateLimitError:
        logger.warning("Rate limit hit — tenacity will retry")
        raise
    except PermanentError as e:
        logger.error(f"Permanent failure: {e}", exc_info=True)
        postgres.insert_failed_item(source="api_name", reason=str(e))
        raise
```

**TypeScript (pipeline jobs):**

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const wait = Math.pow(2, attempt) * 1000
      console.error(`Attempt ${attempt} failed, retrying in ${wait}ms`, err)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw new Error('unreachable')
}
```

**Dead-Letter Queue:** Permanent failures go to `failed_items` Postgres table with `retry_count`, `failure_reason`, `failed_at`.

**LLM Fallback Chain (Python):**

```
Claude 3.5 Sonnet → (2 retries) → Gemini Flash → (2 retries) → Log failure, skip item
```

### Logging Strategy

**Python:**

```python
from loguru import logger

logger.add("logs/pipeline_{time}.log",
    format="{time:ISO} | {level} | {name}:{function}:{line} | {message}",
    level="INFO", rotation="1 week", retention="1 month", serialize=True)

# Always include context:
logger.info("Concept extracted", concept=concept_name, confidence=score, paragraph_id=id)
logger.error("API call failed", attempt=attempt_num, exc_info=True)
```

**TypeScript:** Use `console.error` / `console.info` with structured objects; integrate with cloud logging (CloudWatch / Oracle OCI Logging) in production.

### Cost Tracking Pattern

Every LLM call (Python) records costs:

```python
postgres.update_pipeline_run(
    run_id=run_id,
    llm_tokens_used=response.usage.total_tokens,
    llm_cost_cents=calculate_cost_cents(response.usage, model_name),
    llm_provider=model_name
)
```

---
