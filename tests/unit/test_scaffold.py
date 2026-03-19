"""Smoke tests for Story 1.1 — project scaffold validation."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent


def test_pnpm_workspace_yaml_exists() -> None:
    """AC1: pnpm-workspace.yaml declares apps/* and packages/*."""
    ws = PROJECT_ROOT / "pnpm-workspace.yaml"
    assert ws.exists(), "pnpm-workspace.yaml must exist at repo root"
    content = ws.read_text(encoding='utf-8')
    assert "apps/*" in content
    assert "packages/*" in content


def test_tsconfig_base_exists() -> None:
    """AC2: Root tsconfig.base.json with strict/ES2022/bundler."""
    import json

    tsconfig = PROJECT_ROOT / "tsconfig.base.json"
    assert tsconfig.exists(), "tsconfig.base.json must exist at repo root"
    data = json.loads(tsconfig.read_text(encoding='utf-8'))
    opts = data["compilerOptions"]
    assert opts["strict"] is True
    assert opts["target"] == "ES2022"
    assert opts["moduleResolution"] == "bundler"


def test_child_tsconfigs_extend_base() -> None:
    """AC2: apps/web and packages/pipeline tsconfigs extend base."""
    import json

    for rel in ("apps/web/tsconfig.json", "packages/pipeline/tsconfig.json"):
        path = PROJECT_ROOT / rel
        assert path.exists(), f"{rel} must exist"
        data = json.loads(path.read_text(encoding='utf-8'))
        assert "../../tsconfig.base.json" in data.get("extends", ""), f"{rel} must extend tsconfig.base.json"


def test_eslint_config_exists() -> None:
    """AC3: eslint.config.js exists at repo root."""
    assert (PROJECT_ROOT / "eslint.config.js").exists()


def test_prettierrc_exists() -> None:
    """AC3: .prettierrc exists with required settings."""
    import json

    rc = PROJECT_ROOT / ".prettierrc"
    assert rc.exists()
    data = json.loads(rc.read_text(encoding='utf-8'))
    assert data["singleQuote"] is True
    assert data["semi"] is False
    assert data["printWidth"] == 100


def test_pyproject_toml_exists() -> None:
    """AC4: pyproject.toml with Poetry + Python ^3.10 + ruff + mypy."""
    pyproject = PROJECT_ROOT / "pyproject.toml"
    assert pyproject.exists()
    content = pyproject.read_text(encoding='utf-8')
    assert "[tool.poetry]" in content
    assert 'python = "^3.10"' in content
    assert "ruff" in content
    assert "mypy" in content


def test_docker_compose_exists() -> None:
    """AC5: docker-compose.yml defines postgres, graphdb, redis services."""
    dc = PROJECT_ROOT / "docker-compose.yml"
    assert dc.exists()
    content = dc.read_text(encoding='utf-8')
    assert "pgvector/pgvector:pg16" in content
    assert "ontotext/graphdb" in content
    assert "redis:7-alpine" in content
    assert "pg_isready" in content
    assert "redis-cli" in content


def test_env_example_has_required_vars() -> None:
    """AC6: .env.example documents all required environment variables."""
    env_example = PROJECT_ROOT / ".env.example"
    assert env_example.exists()
    content = env_example.read_text(encoding='utf-8')
    required = [
        "DATABASE_URL",
        "NOTION_API_TOKEN",
        "ANTHROPIC_API_KEY",
        "GITHUB_TOKEN",
        "SLACK_WEBHOOK_URL",
        "TWITTER_BEARER_TOKEN",
        "REDDIT_CLIENT_ID",
        "REDDIT_CLIENT_SECRET",
    ]
    for var in required:
        assert var in content, f"{var} must be documented in .env.example"


def test_env_is_gitignored() -> None:
    """AC6: .env is listed in .gitignore."""
    gitignore = PROJECT_ROOT / ".gitignore"
    assert gitignore.exists()
    lines = gitignore.read_text(encoding='utf-8').splitlines()
    assert any(line.strip() in (".env", ".env*") for line in lines), ".env must be in .gitignore"


def test_directory_scaffold_exists() -> None:
    """AC7: All required directories exist."""
    required_dirs = [
        "apps/web",
        "packages/pipeline/src/jobs",
        "packages/pipeline/src/newly-discovered",
        "packages/pipeline/src/integrations",
        "packages/pipeline/src/publication",
        "handbook/config",
        "handbook/db_connection",
        "handbook/pipeline/evidence_ingestion",
        "handbook/pipeline/writer_agent",
        "scripts",
        "templates",
        ".github/workflows",
        "tests/unit",
        "tests/integration",
    ]
    for d in required_dirs:
        assert (PROJECT_ROOT / d).is_dir(), f"Directory {d} must exist"


def test_handbook_init_files_exist() -> None:
    """AC7: handbook stub modules have __init__.py files."""
    init_files = [
        "handbook/__init__.py",
        "handbook/config/__init__.py",
        "handbook/db_connection/__init__.py",
        "handbook/pipeline/__init__.py",
        "handbook/pipeline/evidence_ingestion/__init__.py",
        "handbook/pipeline/writer_agent/__init__.py",
    ]
    for f in init_files:
        assert (PROJECT_ROOT / f).exists(), f"{f} must exist"


def test_scripts_placeholders_exist() -> None:
    """AC7: scripts/ directory has placeholder files."""
    assert (PROJECT_ROOT / "scripts" / "setup_evidence_layer.sql").exists()
    assert (PROJECT_ROOT / "scripts" / "setup_local.sh").exists()


def test_readme_content() -> None:
    """AC8: README.md covers project description, prerequisites, quick start, CONTRIBUTING link."""
    readme = PROJECT_ROOT / "README.md"
    assert readme.exists()
    content = readme.read_text(encoding='utf-8')
    assert "Prerequisites" in content
    assert "Quick Start" in content
    assert "CONTRIBUTING.md" in content


def test_contributing_and_style_guide_exist() -> None:
    """AC8: CONTRIBUTING.md and STYLE_GUIDE.md placeholders exist."""
    assert (PROJECT_ROOT / "CONTRIBUTING.md").exists()
    assert (PROJECT_ROOT / "STYLE_GUIDE.md").exists()


def test_makefile_targets_exist() -> None:
    """AC8: Makefile has install/dev/test/lint/build targets."""
    makefile = PROJECT_ROOT / "Makefile"
    assert makefile.exists()
    content = makefile.read_text(encoding='utf-8')
    for target in ("install", "dev", "test", "lint", "build"):
        assert f"{target}:" in content, f"Makefile must have a '{target}' target"


def test_env_example_not_gitignored() -> None:
    """AC6: .env.example should NOT be ignored (it must be committed)."""
    gitignore = PROJECT_ROOT / ".gitignore"
    lines = [l.strip() for l in gitignore.read_text(encoding='utf-8').splitlines()]
    assert ".env.example" not in lines, ".env.example must NOT be in .gitignore"


def test_os_env_file_is_blocked() -> None:
    """AC6: Verify .env would be blocked — it should not exist in the repo."""
    env_file = PROJECT_ROOT / ".env"
    # .env may exist locally but should be gitignored; we just check gitignore covers it
    gitignore_content = (PROJECT_ROOT / ".gitignore").read_text(encoding='utf-8')
    assert ".env" in gitignore_content
