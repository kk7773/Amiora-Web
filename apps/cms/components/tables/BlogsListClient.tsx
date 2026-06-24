'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Edit2, Trash2, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'
import { getStorefrontUrl } from '@/lib/storefrontUrl'

interface Blog {
  id: string; title: string; slug: string; is_published: boolean
  published_at?: string | null; created_at: string; cover_url?: string | null
}

export function BlogsListClient({ blogs: initial }: { blogs: Blog[] }) {
  const [blogs, setBlogs] = useState(initial)

  async function del(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/blogs/${id}`, { method: 'DELETE' })
    if (res.ok) { setBlogs(b => b.filter(p => p.id !== id)); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="bg-white rounded-xl border border-divider overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-divider bg-surface">
          <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium w-14"></th>
          <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Title</th>
          <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Status</th>
          <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Published</th>
          <th className="px-5 py-3 text-left text-xs text-ink-faint font-medium">Actions</th>
        </tr></thead>
        <tbody className="divide-y divide-divider">
          {blogs.map(b => (
            <tr key={b.id} className="hover:bg-surface/50">
              <td className="px-5 py-3">
                {b.cover_url ? (
                  <div className="relative w-12 h-8 rounded overflow-hidden bg-surface-2">
                    <Image src={b.cover_url} alt={b.title} fill className="object-cover" sizes="48px" />
                  </div>
                ) : <div className="w-12 h-8 rounded bg-surface-2" />}
              </td>
              <td className="px-5 py-3">
                <p className="font-medium text-ink">{b.title}</p>
                <p className="text-xs text-ink-faint">{b.slug}</p>
              </td>
              <td className="px-5 py-3">
                <Badge variant={b.is_published ? 'success' : 'default'}>
                  {b.is_published ? 'published' : 'draft'}
                </Badge>
              </td>
              <td className="px-5 py-3 text-ink-muted text-xs">
                {b.published_at ? new Date(b.published_at).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <Link href={`/blogs/${b.id}`} className="p-1.5 rounded hover:bg-surface text-ink-muted hover:text-teal" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Link>
                  <a href={`${getStorefrontUrl()}/blogs/${b.slug}`} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded hover:bg-surface text-ink-muted hover:text-teal" title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => del(b.id, b.title)} className="p-1.5 rounded hover:bg-red-50 text-ink-muted hover:text-red-600" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {blogs.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-faint">No blog posts yet</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
