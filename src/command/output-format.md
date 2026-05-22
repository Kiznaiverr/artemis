# Output Format

Return JSON only.

Schema:
{
  "selected": [
    {
      "candidateIndex": 1,
      "reason": "short reason",
      "score": 0.0
    }
  ]
}

Rules:
- `selected` must be ordered from best to worst.
- `candidateIndex` refers to the input candidate list position.
- `reason` must be short.
- `score` should be a number between 0 and 1.
