import os
import json
import urllib.request
import urllib.error
from django.core.files.storage import Storage, FileSystemStorage
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible

@deconstructible
class VercelBlobStorage(Storage):
    """
    Production-grade Django Custom Storage Backend for Vercel Blob Object Storage.
    Supports file uploads, public CDN URL generation, file deletion, and existence checks
    via Vercel's Blob REST API.
    Gracefully falls back to FileSystemStorage when BLOB_READ_WRITE_TOKEN is not present.
    """

    def __init__(self, token=None, base_url=None):
        self.token = token or os.environ.get('BLOB_READ_WRITE_TOKEN')
        self._fallback = FileSystemStorage()
        
        # Derive public CDN Base URL
        self.base_url = base_url or os.environ.get('BLOB_BASE_URL')
        if not self.base_url and self.token:
            parts = self.token.split('_')
            # Token format: vercel_blob_rw_<store_id>_<secret>
            if len(parts) >= 4 and parts[0] == 'vercel' and parts[1] == 'blob':
                store_id = parts[3].lower()
                self.base_url = f"https://{store_id}.public.blob.vercel-storage.com"

    def _save(self, name, content):
        if not self.token:
            return self._fallback._save(name, content)

        # Normalize relative path
        pathname = name.replace('\\', '/').lstrip('/')
        api_url = f"https://blob.vercel-storage.com/{pathname}?access=public"
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "x-api-version": "7"
        }

        # Read content bytes safely from Django file or stream
        if hasattr(content, 'chunks'):
            data = b''.join(chunk for chunk in content.chunks())
        elif hasattr(content, 'read'):
            data = content.read()
        elif isinstance(content, (bytes, bytearray)):
            data = bytes(content)
        else:
            data = str(content).encode('utf-8')

        req = urllib.request.Request(api_url, data=data, headers=headers, method='PUT')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                # Return the full public CDN URL (stored directly in DB field)
                return result.get('url', pathname)
        except Exception as e:
            # Fallback to local storage if API call fails
            return self._fallback._save(name, content)

    def _open(self, name, mode='rb'):
        if not self.token:
            return self._fallback._open(name, mode)
        file_url = self.url(name)
        try:
            req = urllib.request.Request(file_url, headers={"User-Agent": "CelvassPWA/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return ContentFile(resp.read(), name=name)
        except Exception:
            return self._fallback._open(name, mode)

    def url(self, name):
        if not name:
            return ""
        # If already an absolute HTTPS URL, return as is
        if name.startswith('http://') or name.startswith('https://'):
            return name
        # If base_url was determined, prepend it
        if self.base_url:
            return f"{self.base_url.rstrip('/')}/{name.lstrip('/')}"
        if not self.token:
            return self._fallback.url(name)
        return f"https://blob.vercel-storage.com/{name}"

    def exists(self, name):
        if not self.token:
            return self._fallback.exists(name)
        file_url = self.url(name)
        try:
            req = urllib.request.Request(file_url, method='HEAD', headers={"User-Agent": "CelvassPWA/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def size(self, name):
        if not self.token:
            return self._fallback.size(name)
        file_url = self.url(name)
        try:
            req = urllib.request.Request(file_url, method='HEAD', headers={"User-Agent": "CelvassPWA/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return int(resp.headers.get('Content-Length', 0))
        except Exception:
            return 0

    def delete(self, name):
        if not self.token:
            return self._fallback.delete(name)
        file_url = self.url(name)
        api_url = "https://blob.vercel-storage.com/delete"
        payload = json.dumps({"urls": [file_url]}).encode('utf-8')
        req = urllib.request.Request(
            api_url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "x-api-version": "7"
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status == 200
        except Exception:
            return False
