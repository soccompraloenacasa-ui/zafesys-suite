"""
Cloudflare R2 Storage Service
Handles presigned URL generation for photo/signature/video uploads
"""
import boto3
from botocore.config import Config
import os
from datetime import datetime
import uuid


class R2StorageService:
    def __init__(self):
        self.endpoint = os.getenv('R2_ENDPOINT')
        self.access_key = os.getenv('R2_ACCESS_KEY_ID')
        self.secret_key = os.getenv('R2_SECRET_ACCESS_KEY')
        self.bucket = os.getenv('R2_BUCKET', 'zafesys-installations')
        self.public_url = os.getenv('R2_PUBLIC_URL')
        
        if not all([self.endpoint, self.access_key, self.secret_key]):
            raise ValueError("R2 configuration incomplete. Check environment variables.")
        
        self.s3 = boto3.client(
            's3',
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
    
    def generate_upload_url(
        self, 
        installation_id: int, 
        file_type: str, 
        client_name: str
    ) -> dict:
        """
        Generate a presigned URL for uploading a file.
        
        Args:
            installation_id: Installation ID
            file_type: One of 'foto_antes', 'foto_despues', 'firma', 'video'
            client_name: Client name for folder organization

        Returns:
            dict with 'upload_url', 'public_url', 'key'
        """
        # Create date-based path
        date_path = datetime.now().strftime('%Y/%m/%d')
        
        # Clean client name for folder
        safe_name = ''.join(c if c.isalnum() or c == ' ' else '' for c in client_name)
        safe_name = safe_name.replace(' ', '-').lower()[:30]
        
        # Generate unique file ID
        file_id = uuid.uuid4().hex[:8]
        
        # Determine extension and content type based on file_type
        if file_type == 'firma':
            extension = 'png'
            content_type = 'image/png'
        elif file_type == 'video':
            extension = 'mp4'
            content_type = 'video/mp4'
        else:
            # foto_antes, foto_despues
            extension = 'jpg'
            content_type = 'image/jpeg'
        
        # Build key path: 2026/01/27/installation-123-juan-perez/foto_antes-abc123.jpg
        key = f"{date_path}/installation-{installation_id}-{safe_name}/{file_type}-{file_id}.{extension}"
        
        # Generate presigned URL for PUT
        upload_url = self.s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket,
                'Key': key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # 1 hour
        )
        
        # Build public URL
        public_url = f"{self.public_url}/{key}"
        
        return {
            'upload_url': upload_url,
            'public_url': public_url,
            'key': key
        }


# Singleton instance
_r2_service = None

def get_r2_service() -> R2StorageService:
    """Get or create R2 storage service instance."""
    global _r2_service
    if _r2_service is None:
        _r2_service = R2StorageService()
    return _r2_service


# Lazy singleton for backward compatibility
class _LazyR2Storage:
    _instance = None

    def __getattr__(self, name):
        if _LazyR2Storage._instance is None:
            _LazyR2Storage._instance = R2StorageService()
        return getattr(_LazyR2Storage._instance, name)

r2_storage = _LazyR2Storage()
