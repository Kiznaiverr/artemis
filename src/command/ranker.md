# Ranking Task

Task:

- Review each candidate peak.
- Read the local comment context around the peak timestamp.
- Read the subtitle snippet only if it is clipped around the same peak window.
- Rank the candidates by how likely they represent a strong highlight clip.
- Return exactly 5 winners unless fewer than 5 valid candidates exist.

Ranking hints:

- High chat density around the peak matters.
- Spikes in excitement matter more than generic chatter.
- Subtitle context should help explain the moment, not dominate it.
- Ignore candidates with weak or repetitive content.
