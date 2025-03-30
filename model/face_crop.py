import face_recognition
import cv2
import os
import sys
import numpy as np
from PIL import Image, ExifTags


def correct_image_orientation(image_path):
    """
    Correct image orientation using EXIF metadata.
    """
    img = Image.open(image_path)
    try:
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation] == 'Orientation':
                break
        exif = img._getexif()
        if exif and orientation in exif:
            if exif[orientation] == 3:
                img = img.rotate(180, expand=True)
            elif exif[orientation] == 6:
                img = img.rotate(270, expand=True)
            elif exif[orientation] == 8:
                img = img.rotate(90, expand=True)
    except Exception as e:
        print(f"Error correcting orientation: {e}", flush=True)
    return img


def resize_image(image, max_dim=1600):
    """
    Resize the image if its dimensions exceed the maximum allowed dimension.
    """
    height, width = image.shape[:2]
    if max(height, width) > max_dim:
        scale_factor = max_dim / max(height, width)
        new_size = (int(width * scale_factor), int(height * scale_factor))
        image = cv2.resize(image, new_size)
        print(f"Resized image to {new_size}", flush=True)
    return image


def preprocess_image(image_path):
    """
    Preprocess the image by correcting orientation and resizing if needed.
    """
    # Correct orientation
    img = correct_image_orientation(image_path)
    img = np.array(img)
    
    # Resize if necessary
    img = resize_image(img)
    return img


def detect_and_process_face(image_path):
    print(f"Processing image: {image_path}", flush=True)
    try:
        # Preprocess the image
        print("Loading and preprocessing image...", flush=True)
        image = preprocess_image(image_path)
        print(f"Current dimensions of input image: {image.shape[1]}x{image.shape[0]}", flush=True)

        # Detect face locations
        print("Detecting face locations...", flush=True)
        face_locations = face_recognition.face_locations(image)
        print(f"Face locations detected: {face_locations}", flush=True)

        if not face_locations:
            print("No face detected! Skipping...", flush=True)
            return None, None

        # Select the first detected face and expand with padding
        top, right, bottom, left = face_locations[0]
        print(f"Original face coordinates: top={top}, right={right}, bottom={bottom}, left={left}", flush=True)

        # Define padding
        padding = 50
        print(f"Applying padding: {padding}px", flush=True)

        # Get image dimensions
        image_height, image_width, _ = image.shape
        print(f"Image dimensions: width={image_width}, height={image_height}", flush=True)

        # Expand the crop
        top = max(0, top - padding)
        right = min(image_width, right + padding)
        bottom = min(image_height, bottom + padding)
        left = max(0, left - padding)
        print(f"Expanded face coordinates: top={top}, right={right}, bottom={bottom}, left={left}", flush=True)

        # Crop the expanded region
        face_np = image[top:bottom, left:right]
        print("Cropped expanded face region.", flush=True)

        # Save the expanded cropped face
        expanded_output_path = os.path.join(
            os.path.dirname(image_path), 'expanded_cropped_face.jpg'
        )
        Image.fromarray(face_np).save(expanded_output_path, 'JPEG')
        print(f"Expanded cropped face saved to: {expanded_output_path}", flush=True)

        # Process face
        print("Processing face image (applying filters)...", flush=True)

        # Apply median blur
        face_np = cv2.medianBlur(face_np, 1)

        # Convert to YUV and equalize histogram for brightness
        face_yuv = cv2.cvtColor(face_np, cv2.COLOR_RGB2YUV)
        face_yuv[:, :, 0] = cv2.equalizeHist(face_yuv[:, :, 0])
        processed_face = cv2.cvtColor(face_yuv, cv2.COLOR_YUV2RGB)

        # Apply bilateral filter for smoothness
        processed_face = cv2.bilateralFilter(processed_face, d=9, sigmaColor=75, sigmaSpace=75)

        # Save the processed face
        processed_output_path = os.path.join(
            os.path.dirname(image_path), 'processed_face.jpg'
        )
        Image.fromarray(processed_face).save(processed_output_path, 'JPEG')
        print(f"Processed face saved to: {processed_output_path}", flush=True)

        return expanded_output_path, processed_output_path

    except Exception as e:
        print(f"Error processing image: {e}", flush=True)
        return None, None


def generate_embedding(image_path):
    print(f"Generating embedding for image: {image_path}", flush=True)
    try:
        # Load the image
        print("Loading image for embedding...", flush=True)
        image = face_recognition.load_image_file(image_path)
        print("Image loaded successfully.", flush=True)

        # Detect face locations
        print("Detecting face locations for embedding...", flush=True)
        face_locations = face_recognition.face_locations(image)
        print(f"Face locations for embedding: {face_locations}", flush=True)

        if not face_locations:
            print("No face detected! Skipping embedding generation.", flush=True)
            return None

        # Generate embedding for the first face
        print("Generating face encoding...", flush=True)
        encodings = face_recognition.face_encodings(image, known_face_locations=[face_locations[0]])
        if encodings:
            print("Face encoding generated successfully.", flush=True)
            return encodings[0].tolist()
        else:
            print("No encoding found for the face.", flush=True)
            return None
    except Exception as e:
        print(f"Error generating embedding for {image_path}: {e}", flush=True)
        return None


# Main logic
if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python face_crop.py <image_path>", flush=True)
        sys.exit(1)

    image_path = sys.argv[1]
    print(f"Starting face detection and processing for: {image_path}", flush=True)

    original_path, processed_path = detect_and_process_face(image_path)

    if original_path and processed_path:
        # Generate embeddings for both original and processed faces
        print("Generating embeddings for detected faces...", flush=True)
        original_embedding = generate_embedding(original_path)
        processed_embedding = generate_embedding(processed_path)

        print(f"Original embedding: {original_embedding}", flush=True)
        print(f"Processed embedding: {processed_embedding}", flush=True)
        print(f"Original path: {original_path}", flush=True)
        print(f"Processed path: {processed_path}", flush=True)
    else:
        print("Face not detected or error occurred during processing.", flush=True)
        sys.exit(1)
