# Development Notes

## Face Embedding

- Model: InsightFace buffalo_l

- Recognition model produces 512 embeddings.

- Tested embeddings from different images of the same person.

- Tested embeddings from people.

## Similarity

- Qdrant uses cosine similarity.

- Same-person example: ~0.74

- Different-person example: ~0.04

## Enrollment

- Maximum 3 images per person.

- SHA-256 is used to detect duplicate images.

- Face similarity is used to detect whether a new image belongs to an existing person.

- Each person has a person_id.

## Identification

- Query image → face detection → embedding → Qdrant search.

- Top matching embedding is used as the candidate identity.

- development threshold: 0.70.

- Unknown person is rejected when similarity is below threshold.

## Current Tests

- Unknown person → rejected.

- Different image of enrolled Yan LeCun → correctly identified.

- No-face and multiple-face cases → pending.

## Top-K Matching Experiment

Tested identification using the top 2 Qdrant matches.

Example:

- Yan LeCun: 0.7197

- Yan LeCun: 0.7187

Both top matches belonged to the person showing that multiple enrolled images can produce similarly high scores, for the same identity.

This suggests that ambiguity checks should consider person_id than comparing only individual embedding results.

This is important where Multiple embeddings can belong to the person. Therefore top-2 embeddings are not necessarily two competing identities. We need to look at their person_id before deciding whether the result is ambiguous.