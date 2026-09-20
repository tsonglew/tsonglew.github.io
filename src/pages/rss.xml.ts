import { relative, resolve } from 'node:path'
import type { AstroGlobal, ImageMetadata } from 'astro'
import { getImage } from 'astro:assets'
import type { CollectionEntry } from 'astro:content'
import rss from '@astrojs/rss'
import type { Root } from 'mdast'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import config from 'virtual:config'

import { getBlogCollection, sortMDByDate } from 'astro-pure/server'

// Get dynamic import of images as a map collection
const imagesGlob = import.meta.glob<{ default: ImageMetadata }>(
  '/src/**/*.{jpeg,jpg,png,gif,avif,webp,svg}'
)

const renderContent = async (post: CollectionEntry<'blog'>, site: URL) => {
  // Replace image links with the correct path
  function remarkReplaceImageLink() {
    /**
     * @param {Root} tree
     */
    return async (tree: Root) => {
      const promises: Promise<void>[] = []
      visit(tree, 'image', (node) => {
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(node.url)) {
          if (node.url.startsWith('//')) node.url = new URL(node.url, site).href
          return
        }
        if (node.url.startsWith('/') && !node.url.startsWith('/src/')) {
          node.url = new URL(node.url, site).href
          return
        }
        if (!post.filePath) throw new Error(`Missing source path for ${post.id}`)
        const sourcePath = `/${relative(process.cwd(), resolve(post.filePath)).split('\\').join('/')}`
        const imageUrl = new URL(node.url, new URL(sourcePath, site))
        const loadImage = imagesGlob[decodeURIComponent(imageUrl.pathname)]
        if (!loadImage) throw new Error(`Cannot resolve RSS image ${node.url} in ${post.filePath}`)
        promises.push(
          loadImage().then(async ({ default: src }) => {
            const image = await getImage({ src })
            node.url = new URL(image.src, site).href
          })
        )
      })
      await Promise.all(promises)
    }
  }

  const file = await unified()
    .use(remarkParse)
    .use(remarkReplaceImageLink)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(post.body)

  return String(file)
}

const GET = async (context: AstroGlobal) => {
  const allPostsByDate = sortMDByDate(await getBlogCollection()) as CollectionEntry<'blog'>[]
  const siteUrl = context.site ?? new URL(import.meta.env.SITE)

  return rss({
    // Basic configs
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/' },
    stylesheet: '/scripts/pretty-feed-v3.xsl',

    // Contents
    title: config.title,
    description: config.description,
    site: import.meta.env.SITE,
    items: await Promise.all(
      allPostsByDate.map(async (post) => ({
        pubDate: post.data.publishDate,
        link: `/blog/${post.id}`,
        content: await renderContent(post, siteUrl),
        ...post.data
      }))
    )
  })
}

export { GET }
