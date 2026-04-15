"""
Test script for browser-use browser automation with Zhipu AI (z.ai).
"""
import asyncio
import os
from dotenv import load_dotenv

from browser_use import Agent, Browser, ChatOpenAI

load_dotenv()


async def test_browser_use():
    """Simple test to verify browser-use works with Zhipu AI."""
    # Initialize Zhipu AI LLM (OpenAI-compatible API)
    llm = ChatOpenAI(
        model="glm-4-flash",  # or "glm-4", "glm-4-plus"
        api_key=os.getenv("ZAI_API_KEY"),
        base_url="https://open.bigmodel.cn/api/paas/v4/",
        temperature=0.7,
    )

    # Initialize browser
    browser = Browser()

    # Create agent with a simple task
    agent = Agent(
        task="Go to google.com and search for 'browser-use python library', then tell me what it is",
        llm=llm,
        browser=browser,
    )

    # Run the agent
    result = await agent.run()
    print("\n=== Result ===")
    print(result)
    return result


if __name__ == "__main__":
    asyncio.run(test_browser_use())
