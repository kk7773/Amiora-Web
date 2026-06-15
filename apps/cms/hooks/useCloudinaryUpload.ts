'use client'

import { useState } from 'react'
import { toast } from 'sonner'

type UploadResource = 'image' | 'video'

interface UploadResult {
  url:       string
  public_id: string
  width:     number
  height:    number
}

function inferResourceType(file: File): UploadResource {
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

export function useCloudinaryUpload(folder = 'amiora/products') {
  const [uploading, setUploading] = useState(false)

  async function uploadFile(
    file: File,
    options?: { resourceType?: UploadResource; folder?: string },
  ): Promise<UploadResult | null> {
    setUploading(true)
    try {
      const resourceType = options?.resourceType ?? inferResourceType(file)
      const targetFolder = options?.folder ?? folder

      const sigRes = await fetch(`/api/upload?folder=${encodeURIComponent(targetFolder)}`)
      if (!sigRes.ok) throw new Error('Failed to get upload signature')
      const { signature, timestamp, api_key, cloud_name } = await sigRes.json()

      const fd = new FormData()
      fd.append('file',      file)
      fd.append('api_key',   api_key)
      fd.append('timestamp', String(timestamp))
      fd.append('signature', signature)
      fd.append('folder',    targetFolder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`,
        { method: 'POST', body: fd },
      )
      const data = await uploadRes.json()
      if (data.error) throw new Error(data.error.message)

      return {
        url:       data.secure_url,
        public_id: data.public_id,
        width:     data.width ?? 0,
        height:    data.height ?? 0,
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function uploadFiles(
    files: File[],
    options?: { resourceType?: UploadResource; folder?: string },
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = []
    for (const file of files) {
      const result = await uploadFile(file, options)
      if (result) results.push(result)
    }
    return results
  }

  return { uploading, uploadFile, uploadFiles }
}
