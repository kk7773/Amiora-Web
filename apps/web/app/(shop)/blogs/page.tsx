import type { Metadata } from 'next'
import Image from 'next/image'
import Link  from 'next/link'
import { createServerClient } from '@amiora/database'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildBlogListJsonLd, buildWebPageJsonLd } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'Journal',
  description: 'Jewellery stories, styling guides, and care tips from AMIORA.',
}

export const dynamic = 'force-dynamic'

export default async function BlogsPage() {
  const supabase = createServerClient()
  type BlogRow = { id: string; title: string; slug: string; excerpt: string | null; cover_url: string | null; tags: string[] | null; author: string; published_at: string | null }
  const { data: rawPosts } = await supabase
    .from('blogs')
    .select('id, title, slug, excerpt, cover_url, tags, author, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
  const posts = (rawPosts ?? []) as BlogRow[]

  return (
    <div>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            name: 'AMIORA Journal',
            description: 'Jewellery stories, styling guides, and care tips from AMIORA.',
            path: '/blogs',
          }),
          buildBlogListJsonLd(posts),
        ]}
      />
      {/* Header */}
      <div className="bg-surface section-x py-16 text-center">
        <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">From Our Desk</p>
        <h1 className="font-display text-display-2xl text-ink">Journal</h1>
        <p className="text-ink-muted mt-3 max-w-sm mx-auto text-sm">
          Jewellery guides, styling stories, care tips, and the craft behind every piece.
        </p>
      </div>

      {/* Grid */}
      <div className="section-x py-14">
        {!posts?.length ? (
          <p className="text-center text-ink-muted py-20">No articles yet. Check back soon.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blogs/${post.slug}`} className="group block space-y-4">
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-surface">
                  {post.cover_url ? (
                    <Image
                      src={post.cover_url}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-light-teal/20 to-cream" />
                  )}
                </div>
                <div className="space-y-2">
                  {(post.tags as string[] | null)?.[0] && (
                    <span className="text-2xs uppercase tracking-widest text-teal">{(post.tags as string[])[0]}</span>
                  )}
                  <h2 className="font-display text-lg text-ink group-hover:text-deep-teal transition-colors leading-snug">
                    {post.title}
                  </h2>
                  {post.excerpt && <p className="text-sm text-ink-muted line-clamp-2">{post.excerpt}</p>}
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    {post.author && <span>{post.author}</span>}
                    {post.author && post.published_at && <span>·</span>}
                    {post.published_at && (
                      <span>
                        {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
