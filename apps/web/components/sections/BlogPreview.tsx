'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp, stagger } from '@/lib/animations'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_url: string | null
  tags: string[] | null
  published_at: string | null
}

export function BlogPreview({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null

  return (
    <motion.section
      className="section-x section-y"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10">
        <div>
          <p className="text-2xs uppercase tracking-widest2 text-ink mb-2">Journal</p>
          <h2 className="font-display text-display-2xl text-ink">From Our Journal</h2>
        </div>
        <Link
          href="/blogs"
          className="text-sm text-ink hover:text-ink-muted transition-colors underline-offset-4 hover:underline shrink-0"
        >
          Read All →
        </Link>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <motion.article key={post.slug} variants={fadeUp}>
            <Link href={`/blogs/${post.slug}`} className="group block space-y-4">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface">
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
                {post.tags?.[0] && (
                  <span className="text-2xs uppercase tracking-widest text-ink">{post.tags[0]}</span>
                )}
                <h3 className="font-display text-lg text-ink group-hover:text-ink-muted transition-colors leading-snug">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-ink-muted line-clamp-2">{post.excerpt}</p>
                )}
                {post.published_at && (
                  <p className="text-xs text-ink-faint">
                    {new Date(post.published_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </Link>
          </motion.article>
        ))}
      </div>
    </motion.section>
  )
}
