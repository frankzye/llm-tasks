tags: python, venv, tooling

# Python virtual environments

Use a dedicated `.venv` per project. Activate before running scripts.

```bash
python -m venv .venv
source .venv/bin/activate
```

Keep `requirements` or `pyproject.toml` as the source of truth for dependencies.
