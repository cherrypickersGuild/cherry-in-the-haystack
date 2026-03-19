.PHONY: install dev test lint build

install:
	pnpm install
	poetry install

dev:
	docker-compose up -d
	pnpm dev

test:
	pnpm test
	poetry run pytest

lint:
	pnpm lint
	poetry run ruff check handbook/

build:
	pnpm build
