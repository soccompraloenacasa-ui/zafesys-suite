"""
ZAFESYS Suite - Cloudflare R2 Storage Service
"""
import boto3
from botocore.config import Config
import os
from datetime import datetime
import uuid
import re


class R2StorageService:
    """Service for handling file uploads to Cloudflare R2."""

    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('R2_ENDPOINT'),
            aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        self.bucket = os.getenv('R2_BUCKET', 'zafesys-installations')
        self.public_url = os.getenv('R2_PUBLIC_URL', '')

    def _sanitize_name(self, name: str) -> str:
        """Sanitize client name for use in file path."""
        # Remove accents and special characters
        sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', name)
        # Replace spaces with hyphens and lowercase
        sanitized = sanitized.replace(' ', '-').lower()
        # Limit length
        return sanitized[:30]

    def generate_upload_url(
        self,
        installation_id: int,
        file_type: str,
        client_name: str = "cliente"
    ) -> dict:
        """
        Generate presigned URL for uploading a file to R2.

        Args:
            installation_id: Installation ID
            file_type: Type of file (foto_antes, foto_despues, firma)
            client_name: Client name for organizing files

        Returns:
            dict with upload_url, public_url, and key
        """
        date_path = datetime.now().strftime('%Y/%m/%d')
        safe_name = self._sanitize_name(client_name)
        file_id = uuid.uuid4().hex[:8]

        # Determine content type and extension
        if file_type == 'firma':
            content_type = 'image/png'
            extension = 'png'
        else:
            content_type = 'image/jpeg'
            extension = 'jpg'

        # Structure: /2026/01/27/installation-123-juan-perez/foto-antes-abc123.jpg
        key = f"{date_path}/installation-{installation_id}-{safe_name}/{file_type}-{file_id}.{extension}"

        try:
            upload_url = self.s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': key,
                    'ContentType': content_type
                },
                ExpiresIn=3600  # 1 hour
            )

            public_url = f"{self.public_url}/{key}" if self.public_url else None

            return {
                'upload_url': upload_url,
                'public_url': public_url,
                'key': key,
                'content_type': content_type
            }
        except Exception as e:
            raise Exception(f"Error generating upload URL: {str(e)}")

    def delete_file(self, key: str) -> bool:
        """Delete a file from R2."""
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


# Singleton instance
r2_storage = R2StorageService()
