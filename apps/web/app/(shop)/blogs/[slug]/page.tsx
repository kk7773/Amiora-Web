import type { Metadata } from 'next'
import Image from 'next/image'
import Link  from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@amiora/database'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonLd'
import { canonicalFromPath } from '@/lib/seo/site'

interface Props { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServerClient()
  const { data: rawMeta } = await supabase.from('blogs').select('title, excerpt, cover_url').eq('slug', slug).single()
  const data = rawMeta as { title: string; excerpt: string | null; cover_url: string | null } | null
  if (!data) return {}
  const title = `${data.title} — AMIORA Journal`
  const description = data.excerpt ?? ''
  return {
    title,
    description,
    openGraph: {
      title, description,
      url: canonicalFromPath(`/blogs/${slug}`),
      type: 'article',
      images: data.cover_url ? [{ url: data.cover_url }] : [],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: canonicalFromPath(`/blogs/${slug}`) },
  }
}

type BlogPost = {
  id: string; title: string; slug: string; excerpt: string | null; body: string
  cover_url: string | null; author: string; tags: string[] | null; published_at: string | null
}
type RelatedPost = { title: string; slug: string; cover_url: string | null; published_at: string | null }

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: rawPost } = await supabase
    .from('blogs')
    .select('id, title, slug, excerpt, body, cover_url, author, tags, published_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  const post = rawPost as BlogPost | null
  if (!post) notFound()

  const { data: rawRelated } = await supabase
    .from('blogs')
    .select('title, slug, cover_url, published_at')
    .eq('is_published', true)
    .neq('slug', slug)
    .order('published_at', { ascending: false })
    .limit(3)
  const related = (rawRelated ?? []) as RelatedPost[]

  return (
    <article className="max-w-3xl mx-auto section-x py-14">
      <JsonLd
        data={[
          buildBlogPostingJsonLd({
            title: post.title,
            description: post.excerpt,
            slug: post.slug,
            image: post.cover_url,
            author: post.author,
            publishedAt: post.published_at,
            tags: post.tags,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', href: '/' },
            { name: 'Journal', href: '/blogs' },
            { name: post.title, href: `/blogs/${post.slug}` },
          ]),
        ]}
      />
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-muted mb-8">
        <Link href="/" className="hover:text-teal transition-colors">Home</Link>
        <span className="mx-1">/</span>
        <Link href="/blogs" className="hover:text-teal transition-colors">Journal</Link>
        <span className="mx-1">/</span>
        <span className="text-ink">{post.title}</span>
      </nav>

      {/* Tag + Title */}
      {(post.tags as string[] | null)?.[0] && (
        <p className="text-2xs uppercase tracking-widest text-teal mb-3">{(post.tags as string[])[0]}</p>
      )}
      <h1 className="font-display text-display-2xl text-ink leading-tight mb-4">{post.title}</h1>

      {/* Meta */}
      <div className="flex items-center gap-3 text-sm text-ink-muted mb-8">
        {post.author && <span>{post.author}</span>}
        {post.published_at && (
          <>
            <span>·</span>
            <span>{new Date(post.published_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
          </>
        )}
      </div>

      {/* Cover Image */}
      {post.cover_url && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10">
          <Image src={post.cover_url} alt={post.title} fill className="object-cover" priority sizes="720px" />
        </div>
      )}

      {/* Body */}
      <div
        className="prose prose-sm max-w-none
          prose-headings:font-display prose-headings:font-normal prose-headings:text-deep-teal
          prose-a:text-teal prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-xl"
        dangerouslySetInnerHTML={{ __html: (post.body as string) ?? '' }}
      />

      {/* Related */}
      {related && related.length > 0 && (
        <div className="mt-16 pt-10 border-t border-divider">
          <h2 className="font-display text-xl text-ink mb-6">More from the Journal</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/blogs/${r.slug}`} className="group space-y-2">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface">
                  {r.cover_url && (
                    <Image
                      src={r.cover_url}
                      alt={r.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="33vw"
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-ink group-hover:text-deep-teal transition-colors line-clamp-2">
                  {r.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
