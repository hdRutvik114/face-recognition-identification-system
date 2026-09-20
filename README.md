Face recognition system 

# Face Recognition Identification System

This project is a face recognition system that can enroll people and identify them from a new image.

The main idea is simple:

**Image → Face Detection  → Face Embedding → Similarity Search → Known / Unknown**

I built this project as part of the AI/ML Intern assignment for Code Nimbus Solutions.

---

## What the system does

The system supports two main operations:

### 1. Enroll a person :

When a person is enrolled, the system:

1. Takes an image of the person
2. Detects the face in the image.
3. Generates a face embedding.
4. Stores the embedding along with the person's name and ID in Qdrant.

I currently store multiple images for each enrolled person so that the system has more than one representation of the same person (because lighting , Angles , expressions matters)

### 2. Identify a person

When a new image is given:

1. The system detects the face.
2. Generates its face embedding.
3. Searches the enrolled embeddings using similarity.
4. Finds the closest enrolled person.
5. Checks the similarity score against a threshold.
6. If the score is high enough, the person is identified.
7. Otherwise, the system returns **Unknown**.

---

## Model Used

I used **InsightFace with the `buffalo_l` model**.

It provides the face detection and face recognition pipeline that I use in this project.

The face recognition model generates a **512-dimensional embedding** for each detected face.

Instead of comparing the original images directly, I compare these embeddings.

---

## Similarity-Based Matching

The generated face embedding is stored in **Qdrant**, a vector database.

For a new face, its embedding is compared against the enrolled embeddings using **cosine similarity**.

A higher similarity score means that  two face embeddings are same or similar
The system first finds the best matching enrolled person and then checks is checking whther the similarity score is above threshold(A value which is specified after many evaluations using the existing dataset) if they are above then they are similar or else UNKOWN

---

## Unknown Rejection

As I above mentioned
The system should not always return the closest person.

For example, if an unknown person is given to the system, there will still be some enrolled face that is mathematically the "closest".

So I added a similarity threshold.

Currently I am using:

**Threshold = 0.65**

If the best similarity score is below `0.65`, the system rejects the match and returns:

```text
Unknown person


## Handling Invalid Images

The system currently handles some failure cases explicitly.

It returns an error when:

- No face is detected.
- More than one face is detected.
- The input image cannot be read.

For multiple faces, I don't randomly choose one of them. Since this version
of the system is designed to identify one person at a time, the image is
rejected instead.
```

## Evaluation

My test dataset was composed of 43 images with both enrolled and unknown people on them. Evaluation images for enrolled persons are separated from those used during enrollment.

### Threshold Selection

Initially, I tried a threshold value of **0.70**.

While testing, I found that some correct identifications were being rejected because their similarity score was slightly below 0.70. For example:

- Cristiano Ronaldo – 0.654971
- Donald Trump – 0.694228
- Narendra Modi – 0.699977
- Piyush Bansal – 0.664388
- Yann LeCun – 0.692923

I finally ran the evaluation with a threshold value of **0.65**.

### Current Results

`[ADD SCREENSHOT FROM app.log HERE]`

| Metric | Value |
|---|---|
| Known-Person Accuracy | 95.45% |
| False Rejection Rate (FRR) | 4.55% |
| Unknown Rejection Rate | 95.24% |
| False Acceptance Rate (FAR) | 0% |
| Known people correctly identified | 21/22 |
| Unknown people correctly rejected | 20/21 |

Remaining genuine FRR came from one person with their highest similarity score at around 0.62, which was below the current threshold.

> **Note:** These metrics come from my current evaluation dataset only — they don't reflect generalized real-world accuracy.

### Failure Cases

(Here we can make in ,multiple faces can be detetected -> Improvement stage)

If the chosen picturehave many faces in it then  We are unable to select only 1 face from this image — we received a `multiple-face` then it gives error on it. This is by design, as identifying the wrong face can lead to incorrect identifications.


Other possible failure cases include:

- Poor lighting
- Large changes in face angle
- Blurry images
- Very low quality images
- Faces partially hidden
- A person not included in the enrolled database



