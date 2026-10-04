import os
import json
import urllib.request
import urllib.error
from django.core.files.storage import Storage, FileSystemStorage
from django.conf import settings
from django.utils.deconstruct import deconstructible

@deconstructible
class VercelBlobStorage(Storage):
    """
    Django Custom Storage Backend for Vercel Blob Object Storage.
    Supports file uploads directly to Vercel Blob with public CDN URLs.
    Falls back to FileSystemStorage when BLOB_READ_WRITE_TOKEN is not configured.
    """

    def __init__(self, token=None):
        self.token = token or os.environ.get('BLOB_READ_WRITE_TOKEN')
        self._fallback = FileSystemStorage()

    def _save(self, name, content):
        if not self.token:
            return self._fallback._save(name, content)

        # Normalize path
        pathname = name.replace('\\', '/').lstrip('/')
        url = f"https://blob.vercel-storage.com/{pathname}?access=public"
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "x-api-version": "7"
        }

        # Read content bytes
        if hasattr(content, 'chunks'):
            data = b''.join(chunk for chunk in content.chunks())
        else:
            data = content.read()

        req = urllib.request.Request(url, data=data, headers=headers, method='PUT')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                # Store the public URL as the filename/identifier
                return result.get('url', pathname)
        except Exception as e:
            # If upload fails, fallback to local storage
            return self._fallback._save(name, content)

    def url(self, name):
        if not name:
            return ""
        # If name is already a full Vercel Blob URL or HTTPS URL, return it
        if name.startswith('http://') or name.startswith('https://'):
            return name
        if not self.token:
            return self._fallback.url(name)
        return f"https://blob.vercel-storage.com/{name}"

    def exists(self, name):
        if not self.token:
            return self._fallback.exists(name)
        return False

    def size(self, name):
        return 0

    def delete(self, name):
        if not self.token:
            return self._fallback.delete(name)
        # Optional: delete via DELETE https://blob.vercel-storage.com/...
        pass
