"""
Face recognition service using InsightFace.

Responsibilities:
- Initialize InsightFace FaceAnalysis (buffalo_l model)
- Register faces: extract and store embeddings
- Recognize faces: detect → embed → cosine similarity match
- Return bounding boxes for live overlay
"""

import logging
import numpy as np
import cv2
from typing import Optional
from insightface.app import FaceAnalysis
from app.core.config import settings

logger = logging.getLogger(__name__)


class FaceService:
    """Singleton face recognition service using InsightFace buffalo_l model."""

    _instance: Optional["FaceService"] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self):
        """Load the InsightFace model. Call once at startup."""
        if self._initialized:
            return

        logger.info(f"Loading InsightFace model: {settings.FACE_MODEL_NAME}")
        self.app = FaceAnalysis(name=settings.FACE_MODEL_NAME)
        # ctx_id=0 for GPU, -1 for CPU
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        self._initialized = True
        logger.info("InsightFace model loaded successfully")

    def extract_embeddings_from_image(self, image_bytes: bytes) -> list[np.ndarray]:
        """
        Extract face embeddings from a single image.
        
        Args:
            image_bytes: Raw image bytes (JPEG/PNG).
            
        Returns:
            List of normalized embedding vectors (one per detected face).
        """
        if not self._initialized:
            self.initialize()

        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            logger.warning("Failed to decode image")
            return []

        faces = self.app.get(img)
        embeddings = []
        for face in faces:
            if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
                embeddings.append(face.normed_embedding)
        return embeddings

    def extract_embeddings_from_frame(self, frame: np.ndarray) -> list[dict]:
        """
        Extract face embeddings and bounding boxes from an OpenCV frame.
        
        Args:
            frame: BGR numpy array from OpenCV.
            
        Returns:
            List of dicts with 'embedding' (ndarray) and 'bbox' ([x1,y1,x2,y2]).
        """
        if not self._initialized:
            self.initialize()

        faces = self.app.get(frame)
        results = []
        for face in faces:
            if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
                bbox = face.bbox.astype(int).tolist()
                results.append({
                    "embedding": face.normed_embedding,
                    "bbox": bbox,
                })
        return results

    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compute cosine similarity between two L2-normalized embeddings.
        Since InsightFace provides normalized embeddings, dot product = cosine similarity.
        """
        return float(np.dot(embedding1, embedding2))

    def find_best_match(
        self,
        query_embedding: np.ndarray,
        stored_embeddings: list[dict],
    ) -> tuple[Optional[int], float]:
        """
        Find the best matching student for a query embedding.
        
        Args:
            query_embedding: The face embedding to match.
            stored_embeddings: List of dicts with 'student_id' and 'embedding'.
            
        Returns:
            Tuple of (student_id, confidence) or (None, 0.0) if no match above threshold.
        """
        threshold = settings.FACE_SIMILARITY_THRESHOLD
        best_match_id = None
        best_score = 0.0

        for stored in stored_embeddings:
            emb = np.array(stored["embedding"], dtype=np.float32)
            score = self.compute_similarity(query_embedding, emb)

            if score > best_score and score >= threshold:
                best_score = score
                best_match_id = stored["student_id"]

        return best_match_id, best_score

    def register_faces(self, images_bytes_list: list[bytes]) -> list[list[float]]:
        """
        Process multiple captured images and return averaged embeddings.
        
        Args:
            images_bytes_list: List of image byte arrays.
            
        Returns:
            List of embedding vectors (as Python lists of floats).
            Typically returns one averaged embedding if same person in all images.
        """
        all_embeddings = []
        for img_bytes in images_bytes_list:
            embeddings = self.extract_embeddings_from_image(img_bytes)
            if embeddings:
                # Take the first face from each image (assuming one student per capture)
                all_embeddings.append(embeddings[0])

        if not all_embeddings:
            return []

        # Average all embeddings for a more robust representation
        avg_embedding = np.mean(all_embeddings, axis=0)
        # Re-normalize after averaging
        norm = np.linalg.norm(avg_embedding)
        if norm > 0:
            avg_embedding = avg_embedding / norm

        return [avg_embedding.tolist()]


# Global singleton instance
face_service = FaceService()
